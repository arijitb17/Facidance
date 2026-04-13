// scripts/verify-attendance.ts
// Run this to check for duplicates in your database
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyAttendance() {
  try {
    // Get all attendance records
    const allAttendance = await prisma.attendance.findMany({
      include: {
        course: { select: { name: true, code: true } },
        student: { 
          include: { 
            user: { select: { email: true } } 
          } 
        },
      },
      orderBy: { timestamp: "asc" },
    });

    console.log(`\n📊 Total attendance records: ${allAttendance.length}\n`);

    // Group by student + course
    const byCourse = new Map<string, typeof allAttendance>();

    allAttendance.forEach((record) => {
      const key = `${record.studentId}-${record.courseId}`;
      if (!byCourse.has(key)) {
        byCourse.set(key, []);
      }
      byCourse.get(key)!.push(record);
    });

    // Analyze each student-course combination
    for (const [key, records] of byCourse.entries()) {
      const studentEmail = records[0].student.user.email;
      const courseName = records[0].course?.name || "Unknown";
      const courseCode = records[0].course?.code || "N/A";

      console.log(`\n📚 ${courseName} (${courseCode}) - ${studentEmail}`);
      console.log(`   Total records: ${records.length}`);

      // Check for duplicates by date
      const byDate = new Map<string, typeof records>();
      
      records.forEach((record) => {
        const date = record.timestamp.toISOString().split('T')[0];
        if (!byDate.has(date)) {
          byDate.set(date, []);
        }
        byDate.get(date)!.push(record);
      });

      const uniqueDates = byDate.size;
      console.log(`   Unique dates: ${uniqueDates}`);

      // Find duplicates
      const duplicateDates: string[] = [];
      byDate.forEach((dateRecords, date) => {
        if (dateRecords.length > 1) {
          duplicateDates.push(date);
          console.log(`   ⚠️  DUPLICATE on ${date}: ${dateRecords.length} records`);
          dateRecords.forEach((r, i) => {
            console.log(`      ${i + 1}. ${r.timestamp.toISOString()} - ${r.status ? 'PRESENT' : 'ABSENT'}`);
          });
        }
      });

      // Calculate stats
      const presentCount = Array.from(byDate.values())
        .filter(dateRecords => dateRecords.some(r => r.status === true))
        .length;
      
      const percentage = ((presentCount / uniqueDates) * 100).toFixed(1);
      console.log(`   ✅ After deduplication: ${presentCount}/${uniqueDates} present (${percentage}%)`);
    }

    console.log("\n\n📝 Summary:");
    console.log(`   Total records in DB: ${allAttendance.length}`);
    console.log(`   Student-course combinations: ${byCourse.size}`);
    
    // Count total unique sessions
    let totalUniqueSessions = 0;
    byCourse.forEach((records) => {
      const dates = new Set(records.map(r => r.timestamp.toISOString().split('T')[0]));
      totalUniqueSessions += dates.size;
    });
    console.log(`   Total unique sessions: ${totalUniqueSessions}`);
    console.log(`   Duplicate records: ${allAttendance.length - totalUniqueSessions}\n`);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAttendance();