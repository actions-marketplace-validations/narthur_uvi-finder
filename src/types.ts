import type { getOctokit } from "@actions/github";
import type { OpenAI } from "openai";

// Base options interface
interface BaseOptions {
  octokit: ReturnType<typeof getOctokit>;
  openai: OpenAI;
  model: string;
  owner: string;
  repo: string;
}

// PR-specific options
interface PROptions extends BaseOptions {
  pullNumber: number;
  base: string;
  head: string;
}

// Push-specific options
interface PushOptions extends BaseOptions {
  base: string;
  head: string;
}

// Union type for all possible options
export type FindUVIsOptions = PROptions | PushOptions;

export interface UpdatePRCommentOptions {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  pullNumber: number;
  uvis: UVI[];
  header: string;
}

export interface UVI {
  description: string;
  category?: string;
  impact?: string;
}

export interface GetProductContextOptions {
  octokit: ReturnType<typeof getOctokit>;
  openai: OpenAI;
  model: string;
  owner: string;
  repo: string;
}
