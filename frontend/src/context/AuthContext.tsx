import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../lib/api-client';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface GoogleAuthPayload {
  credential?: string;
  access_token?: string;
}

export interface SendOtpResult {
  message: string;
  expires_in: number;
  resend_cooldown: number;
  otp_mode: 'demo' | 'sms';
  demo_otp?: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  message: string;
  phone_verification_token: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (payload: string | GoogleAuthPayload) => Promise<User>;
  sendMobileOtp: (phone: string) => Promise<SendOtpResult>;
  verifyMobileOtp: (phone: string, otp: string) => Promise<VerifyOtpResult>;
  register: (email: string, phone: string, password: string, phone_verification_token?: string) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'ezfinanz_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.get<User>('/auth/me');
      setUser(response.data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post<{ access_token: string }>('/auth/login', {
        email,
        password,
      });
      const newToken = response.data.access_token;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      const meResponse = await apiClient.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      setUser(meResponse.data);
      return meResponse.data;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (payload: string | GoogleAuthPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const body = typeof payload === 'string' ? { credential: payload } : payload;
      const response = await apiClient.post<{ access_token: string }>('/auth/google', body);
      const newToken = response.data.access_token;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      const meResponse = await apiClient.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` },
      });
      setUser(meResponse.data);
      return meResponse.data;
    } finally {
      setIsLoading(false);
    }
  };

  const sendMobileOtp = async (phone: string): Promise<SendOtpResult> => {
    const response = await apiClient.post<SendOtpResult>('/auth/send-mobile-otp', {
      phone,
    });
    return response.data;
  };

  const verifyMobileOtp = async (phone: string, otp: string): Promise<VerifyOtpResult> => {
    const response = await apiClient.post<VerifyOtpResult>('/auth/verify-mobile-otp', {
      phone,
      otp,
    });
    return response.data;
  };

  const register = async (
    email: string,
    phone: string,
    password: string,
    phone_verification_token?: string
  ) => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', {
        email,
        phone,
        password,
        phone_verification_token,
      });
      // Automatically login after successful registration
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        sendMobileOtp,
        verifyMobileOtp,
        register,
        logout,
        refetchUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
