// lib/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

/**
 * Compare password with hash, supporting multiple DOB formats for students
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  // First try direct comparison
  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
  if (isMatch) return true;

  // If direct comparison fails, try DOB format variations
  // This handles cases where students enter DOB with/without separators
  const passwordVariations = [
    plainPassword.replace(/[-/\s]/g, ""), // Remove all separators: 2004-03-13 -> 20040313
    plainPassword.replace(/\//g, "-"),     // Replace slashes: 13/03/2004 -> 13-03-2004
    plainPassword.replace(/-/g, "/"),      // Replace dashes: 2004-03-13 -> 2004/03/13
  ];

  // Try each variation
  for (const variation of passwordVariations) {
    if (variation === plainPassword) continue; // Skip if same as original
    const match = await bcrypt.compare(variation, hashedPassword);
    if (match) return true;
  }

  return false;
}

/**
 * Hash password before storing
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  // Remove separators for consistency (for DOB passwords)
  const cleanedPassword = plainPassword.replace(/[-/\s]/g, "");
  return await bcrypt.hash(cleanedPassword, 10);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: { id: string; role: string }): string {
  // Include both id and userId for compatibility
  return jwt.sign(
    {
      id: payload.id,
      userId: payload.id, // Add userId for compatibility
      role: payload.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): { id: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    return decoded;
  } catch (error) {
    return null;
  }
}