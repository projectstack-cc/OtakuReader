"use strict";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { databaseService } from "./database";
import { appLogger } from "../lib/utils/logger";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  isActive: boolean;
  createdAt: number;
  lastLogin?: number;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  language?: string;
  readingProgress?: Record<string, number>; // chapterId -> lastPageIndex
  notifications?: boolean;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
}

export interface LoginResult {
  success: boolean;
  user?: Omit<User, "passwordHash">;
  token?: AuthToken;
  error?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
  userAgent?: string;
  ipAddress?: string;
  isValid: boolean;
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: number;
  private readonly bcryptRounds: number;
  private sessions: Map<string, Session> = new Map();

  private constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "otakureader-jwt-secret-key-change-in-production";
    this.jwtExpiresIn = parseInt(process.env.JWT_EXPIRES_IN || "86400"); // 24 hours
    this.bcryptRounds = 12;
  }

  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  public async initialize(): Promise<void> {
    // Clean up expired sessions
    await this.cleanupExpiredSessions();
    appLogger.info("Authentication service initialized");
  }

  public async registerUser(username: string, password: string, email?: string): Promise<User> {
    // Validate input
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    if (username.length < 3 || username.length > 50) {
      throw new Error("Username must be between 3 and 50 characters");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Check if username already exists
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

    // Create user
    const user: User = {
      id: this.generateUserId(),
      username,
      passwordHash,
      email,
      isActive: true,
      createdAt: Date.now(),
      preferences: {
        theme: "system",
        language: "en",
        notifications: true,
      },
    };

    // Store user in database
    await databaseService.addUser(user);

    appLogger.info("User registered", { userId: user.id, username });
    return user;
  }

  public async loginUser(username: string, password: string): Promise<LoginResult> {
    try {
      // Get user by username
      const user = await this.getUserByUsername(username);
      if (!user || !user.isActive) {
        return { success: false, error: "Invalid username or password" };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return { success: false, error: "Invalid username or password" };
      }

      // Update last login
      await this.updateUserLastLogin(user.id);

      // Generate token
      const token = this.generateToken(user.id);
      const expiresAt = Date.now() + this.jwtExpiresIn * 1000;

      // Create session
      const session: Session = {
        id: this.generateSessionId(),
        userId: user.id,
        token,
        expiresAt,
        createdAt: Date.now(),
        isValid: true,
      };

      this.sessions.set(session.id, session);
      await databaseService.saveSession(session);

      // Remove password hash from returned user
      const { passwordHash, ...safeUser } = user;

      appLogger.info("User logged in", { userId: user.id, sessionId: session.id });

      return {
        success: true,
        user: safeUser,
        token: { token, expiresAt },
      };
    } catch (error) {
      appLogger.error("Login failed", { error: error instanceof Error ? error.message : String(error), username });
      return { success: false, error: "Authentication failed" };
    }
  }

  public async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const userId = decoded.userId;

      // Check session in database
      const session = await databaseService.getSessionByToken(token);
      if (!session || !session.isValid || session.expiresAt < Date.now()) {
        return null;
      }

      // Get user
      const user = await this.getUserById(userId);
      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      appLogger.warn("Token validation failed", { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async logoutUser(userId: string, sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;
      this.sessions.set(sessionId, session);
      await databaseService.updateSession(sessionId, { isValid: false });
    }

    appLogger.info("User logged out", { userId, sessionId });
  }

  public async getCurrentUser(userId: string): Promise<User | null> {
    return await this.getUserById(userId);
  }

  public async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updatedUser = {
      ...user,
      preferences: { ...user.preferences, ...preferences },
    };

    await databaseService.updateUser(updatedUser);
    appLogger.info("User preferences updated", { userId });
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Current password is incorrect");
    }

    if (newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.bcryptRounds);
    const updatedUser = { ...user, passwordHash: newPasswordHash };

    await databaseService.updateUser(updatedUser);
    appLogger.info("Password changed", { userId });
  }

  public async deleteUser(userId: string, password: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error("Password is incorrect");
    }

    await databaseService.deleteUser(userId);
    
    // Invalidate all sessions
    await this.invalidateUserSessions(userId);

    appLogger.info("User deleted", { userId });
  }

  public async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessionIds: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt < now) {
        expiredSessionIds.push(sessionId);
      }
    }

    for (const sessionId of expiredSessionIds) {
      this.sessions.delete(sessionId);
    }

    // Clean up expired sessions from database
    await databaseService.cleanupExpiredSessions();

    if (expiredSessionIds.length > 0) {
      appLogger.info("Cleaned up expired sessions", { count: expiredSessionIds.length });
    }
  }

  public async invalidateUserSessions(userId: string): Promise<void> {
    const sessionIds = Array.from(this.sessions.entries())
      .filter(([_, session]) => session.userId === userId && session.isValid)
      .map(([sessionId]) => sessionId);

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isValid = false;
        this.sessions.set(sessionId, session);
        await databaseService.updateSession(sessionId, { isValid: false });
      }
    }

    appLogger.info("User sessions invalidated", { userId, count: sessionIds.length });
  }

  private async getUserById(userId: string): Promise<User | null> {
    return await databaseService.getUserById(userId);
  }

  private async getUserByUsername(username: string): Promise<User | null> {
    return await databaseService.getUserByUsername(username);
  }

  private async updateUserLastLogin(userId: string): Promise<void> {
    await databaseService.updateUserLastLogin(userId);
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, this.jwtSecret, { expiresIn: `${this.jwtExpiresIn}s` });
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}

export const authService = AuthenticationService.getInstance();