// scripts/delete-attendance.ts
// WARNING: This will delete ALL attendance records!
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteAllAttendance() {
  try {
    console.log("⚠️  WARNING: This will delete ALL attendance records!");
    console.log("⏳ Starting deletion in 3 seconds...\n");
    
    // Wait 3 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Count records before deletion
    const countBefore = await prisma.attendance.count();
    console.log(`📊 Total attendance records: ${countBefore}\n`);

    // Delete all attendance records
    const result = await prisma.attendance.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.count} attendance records\n`);

    // Verify deletion
    const countAfter = await prisma.attendance.count();
    console.log(`📊 Remaining records: ${countAfter}`);

    if (countAfter === 0) {
      console.log("✨ Attendance table is now empty!\n");
    } else {
      console.log("⚠️  Warning: Some records may still remain\n");
    }

  } catch (error) {
    console.error("❌ Error deleting attendance records:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllAttendance();