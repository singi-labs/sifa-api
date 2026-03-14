import { z } from 'zod';

const locationSchema = z
  .union([
    z.object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional(),
      countryCode: z.string().length(2).optional(),
    }),
    z.string(),
  ])
  .optional();

export const profileSelfSchema = z
  .object({
    headline: z.string().max(300).optional(),
    about: z.string().max(50000).optional(),
    industry: z.string().max(100).optional(),
    location: locationSchema,
    openTo: z.array(z.string()).max(10).optional(),
    preferredWorkplace: z.array(z.string()).max(3).optional(),
    langs: z.array(z.string()).max(3).optional(),
  })
  .passthrough();

export const positionSchema = z.object({
  companyName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(50000).optional(),
  employmentType: z.string().optional(),
  workplaceType: z.string().optional(),
  location: locationSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
});

export const educationSchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().max(200).optional(),
  fieldOfStudy: z.string().max(200).optional(),
  description: z.string().max(50000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const skillSchema = z.object({
  skillName: z.string().min(1).max(100),
  category: z.string().max(100).optional(),
});

export const certificationSchema = z.object({
  name: z.string().min(1).max(100),
  authority: z.string().max(100).optional(),
  credentialId: z.string().max(100).optional(),
  credentialUrl: z.string().url().optional(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(50000).optional(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const volunteeringSchema = z.object({
  organization: z.string().min(1).max(100),
  role: z.string().max(100).optional(),
  cause: z.string().max(100).optional(),
  description: z.string().max(50000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const publicationSchema = z.object({
  title: z.string().min(1).max(200),
  publisher: z.string().max(100).optional(),
  url: z.string().url().optional(),
  description: z.string().max(50000).optional(),
  publishedAt: z.string().optional(),
});

export const courseSchema = z.object({
  name: z.string().min(1).max(200),
  number: z.string().max(50).optional(),
  institution: z.string().max(100).optional(),
});

export const honorSchema = z.object({
  title: z.string().min(1).max(200),
  issuer: z.string().max(100).optional(),
  description: z.string().max(50000).optional(),
  awardedAt: z.string().optional(),
});

export const languageSchema = z.object({
  name: z.string().min(1).max(64),
  proficiency: z.string().max(50).optional(),
});

export const VALID_PLATFORMS = [
  'rss',
  'fediverse',
  'twitter',
  'instagram',
  'github',
  'youtube',
  'linkedin',
  'website',
  'other',
] as const;

export const COLLECTION_SCHEMAS: Record<string, z.ZodType> = {
  'id.sifa.profile.certification': certificationSchema,
  'id.sifa.profile.project': projectSchema,
  'id.sifa.profile.volunteering': volunteeringSchema,
  'id.sifa.profile.publication': publicationSchema,
  'id.sifa.profile.course': courseSchema,
  'id.sifa.profile.honor': honorSchema,
  'id.sifa.profile.language': languageSchema,
};

export const externalAccountSchema = z.object({
  platform: z.enum(VALID_PLATFORMS),
  url: z.string().url().max(2000),
  label: z.string().max(100).optional(),
  feedUrl: z.string().url().max(2000).optional(),
});
