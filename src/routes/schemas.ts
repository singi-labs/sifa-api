import { z } from 'zod';

export const profileSelfSchema = z.object({
  headline: z.string().max(120).optional(),
  about: z.string().max(50000).optional(),
  industry: z.string().max(100).optional(),
  location: z
    .object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  website: z.string().url().optional(),
  openTo: z.array(z.string()).max(10).optional(),
  preferredWorkplace: z.array(z.string()).max(3).optional(),
  langs: z.array(z.string()).max(3).optional(),
});

export const positionSchema = z.object({
  companyName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(50000).optional(),
  employmentType: z.string().optional(),
  workplaceType: z.string().optional(),
  location: z
    .object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  startDate: z.string(),
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
