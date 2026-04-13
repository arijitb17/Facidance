// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Attendance Seeder
 * Period: Nov 10, 2024 – Nov 30, 2024
 * Days: Mon, Wed, Fri (3 weeks)
 */

const students = [
  { id: "cmjmoth65000huw68ccd5lcum", rate: 0.95 },
  { id: "cmjmoti6n000kuw6833e9g8fr", rate: 0.92 },
  { id: "cmjmotirp000nuw68id39qyhh", rate: 0.88 },
  { id: "cmjmotjb8000quw68xhfdwm78", rate: 0.82 },
  { id: "cmjmotjvx000tuw68op9coyz1", rate: 0.75 },
  { id: "cmjmotkfp000wuw68qz9bsq2s", rate: 0.75 },
  { id: "cmjmotkz8000zuw68ill1bls5", rate: 0.72 },
  { id: "cmjmotlii0012uw6852e1cgvs", rate: 0.68 },
  { id: "cmjmotm1v0015uw68sq6vm3kl", rate: 0.49 },
  { id: "cmjmotmli0018uw6849d5t2tg", rate: 0.45 },
  { id: "cmjmozqoi001buw68v2kq5vkq", rate: 0.93 },
  { id: "cmjmozs79001euw68l7msny2x", rate: 0.91 },
  { id: "cmjmozspz001huw6865e7z8ja", rate: 0.85 },
  { id: "cmjmozt8s001kuw682c5ohejr", rate: 0.8 },
  { id: "cmjmozuc3001nuw68t3gikoeq", rate: 0.75 },
  { id: "cmjmozuy3001quw681bktrj6n", rate: 0.7 },
  { id: "cmjmp3j9e001tuw68p5vrat7j", rate: 0.65 },
  { id: "cmjmp3nqr001wuw68rhiuoz5l", rate: 0.48 },
  { id: "cmjmp3o98001zuw686r7i6uqi", rate: 0.42 },
];

const courses = [
  { id: "cmjhfan4k000nuwp4vne02gie" },
  { id: "cmjhfc2bv000ruwp46tw5y3q6" },
  { id: "cmjhffwhw000xuwp4a9wetdiq" },
  { id: "cmjhfi59p0013uwp4phh6bazf" },
  { id: "cmjhfjbal0017uwp4f068vsfb" },
];

// Generate Mon/Wed/Fri dates from Nov 10 to Nov 30, 2024
function generateClassDates() {
  const dates = [];
  const start = new Date("2024-11-10");
  const end = new Date("2024-11-30");
  
  // Different times for variety (10 AM, 2 PM, 4 PM)
  const times = ["10:00", "14:00", "16:00"];
  let timeIndex = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    // Monday = 1, Wednesday = 3, Friday = 5
    if (day === 1 || day === 3 || day === 5) {
      const dateStr = d.toISOString().split("T")[0];
      const time = times[timeIndex % times.length];
      dates.push(new Date(`${dateStr}T${time}:00.000Z`));
      timeIndex++;
    }
  }
  
  return dates;
}

async function main() {
  console.log("📌 Seeding attendance records...");
  console.log("📅 Period: Nov 10 - Nov 30, 2024 (Mon/Wed/Fri)");
  
  const classDates = generateClassDates();
  console.log(`📊 Total class sessions: ${classDates.length}`);
  console.log("📅 Class dates:");
  classDates.forEach((date, i) => {
    console.log(`   ${i + 1}. ${date.toLocaleString()}`);
  });

  let count = 0;
  let presentCount = 0;

  console.log("\n🔄 Creating attendance records...\n");

  for (const student of students) {
    for (const course of courses) {
      for (const timestamp of classDates) {
        // Random attendance based on student's rate
        const present = Math.random() < student.rate;

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            courseId: course.id,
            status: present,
            timestamp,
            photoPath: present
              ? `uploads/attendance/${student.id}_${timestamp.getTime()}.jpg`
              : null,
          },
        });

        count++;
        if (present) presentCount++;
      }
    }
  }

  const overallRate = ((presentCount / count) * 100).toFixed(1);

  console.log(`\n✅ Attendance seeded successfully!`);
  console.log(`📊 Statistics:`);
  console.log(`   Total records: ${count}`);
  console.log(`   Present: ${presentCount} (${overallRate}%)`);
  console.log(`   Absent: ${count - presentCount}`);
  console.log(`   Students: ${students.length}`);
  console.log(`   Courses: ${courses.length}`);
  console.log(`   Sessions per course: ${classDates.length}`);
  console.log(`   Expected records per student: ${courses.length * classDates.length}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });