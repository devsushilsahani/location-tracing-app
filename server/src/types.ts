import { Request, Response } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export interface TypedRequest<T = any, U extends ParsedQs = ParsedQs> extends Request {
  body: T;
  query: U;
}

export interface LocationRequestBody {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  timestamp: number;
  deviceId?: string; // Optional device identifier
}

export interface LocationQueryParams {
  startTime?: string;
  endTime?: string;
  olderThan?: string;
  date?: string;
  [key: string]: string | string[] | undefined;
}

export interface RouteRequestBody {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  distance: number;
  userId?: string;
  locations?: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
    speed?: number;
    timestamp: number;
  }>;
}

export type TypedResponse<T = any> = Response<T>;

export interface UserHistoryQueryParams {
  userId: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  page?: string;
  [key: string]: string | string[] | undefined;
}

export interface UserTraceRequestBody {
  userId: string;
  startTime: string;
  endTime?: string;
  includeRoutes?: boolean;
}

export interface UserRetraceRequestBody {
  routeId: string;
  userId?: string;
  speed?: number; // Speed multiplier for retracing (1 = normal, 2 = 2x speed, etc.)
}
