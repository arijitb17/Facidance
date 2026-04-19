// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function hash(password) {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  console.log("🌱 Starting full seed...");

  // ─── Admin ───────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@gauhati.ac.in" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@gauhati.ac.in",
      password: hash("admin123"),
      role: "ADMIN",
    },
  });
  console.log("✅ Admin created");

  // ─── Departments ─────────────────────────────────────────────────────
  const deptCS = await prisma.department.upsert({
    where: { id: "dept_cs_001" },
    update: {},
    create: { id: "dept_cs_001", name: "Computer Science" },
  });

  const deptIT = await prisma.department.upsert({
    where: { id: "dept_it_001" },
    update: {},
    create: { id: "dept_it_001", name: "Information Technology" },
  });

  const deptECE = await prisma.department.upsert({
    where: { id: "dept_ece_001" },
    update: {},
    create: { id: "dept_ece_001", name: "Electronics and Communication Engineering" },
  });
  console.log("✅ Departments created");

  // ─── Programs ────────────────────────────────────────────────────────
  const progBTechCSE = await prisma.program.upsert({
    where: { id: "prog_btech_cse" },
    update: {},
    create: { id: "prog_btech_cse", name: "B.Tech in Computer Science", departmentId: deptCS.id },
  });

  const progBTechIT = await prisma.program.upsert({
    where: { id: "prog_btech_it" },
    update: {},
    create: { id: "prog_btech_it", name: "B.Tech in Information Technology", departmentId: deptIT.id },
  });

  const progBTechAI = await prisma.program.upsert({
    where: { id: "prog_btech_ai" },
    update: {},
    create: { id: "prog_btech_ai", name: "B.Tech in Artificial Intelligence", departmentId: deptCS.id },
  });

  const progBTechECE = await prisma.program.upsert({
    where: { id: "prog_btech_ece" },
    update: {},
    create: { id: "prog_btech_ece", name: "B.Tech in Electronics and Communication", departmentId: deptECE.id },
  });
  console.log("✅ Programs created");

  // ─── Academic Years ──────────────────────────────────────────────────
  const ay2324CSE = await prisma.academicYear.upsert({
    where: { id: "ay_2324_cse" },
    update: {},
    create: { id: "ay_2324_cse", name: "2023-2024", programId: progBTechCSE.id },
  });

  const ay2324IT = await prisma.academicYear.upsert({
    where: { id: "ay_2324_it" },
    update: {},
    create: { id: "ay_2324_it", name: "2023-2024", programId: progBTechIT.id },
  });
  console.log("✅ Academic years created");

  // ─── Semesters ───────────────────────────────────────────────────────
  const sem5CSE = await prisma.semester.upsert({
    where: { id: "sem_5_cse" },
    update: {},
    create: { id: "sem_5_cse", name: "Semester 5", academicYearId: ay2324CSE.id },
  });

  const sem5IT = await prisma.semester.upsert({
    where: { id: "sem_5_it" },
    update: {},
    create: { id: "sem_5_it", name: "Semester 5", academicYearId: ay2324IT.id },
  });
  console.log("✅ Semesters created");

  // ─── Teachers ────────────────────────────────────────────────────────
const teacherUsers = [
  { name: "Prof. Sikhar Kumar Sarma", email: "sikhar@gauhati.ac.in", deptId: deptCS.id },
  { name: "Dr. Satyajit Sarma", email: "satyajit@gauhati.ac.in", deptId: deptCS.id },
  { name: "Dr. Rupam Bhattacharya", email: "rupam@gauhati.ac.in", deptId: deptIT.id },
  { name: "Dr. Nabamita Deb", email: "nabamita@gauhati.ac.in", deptId: deptIT.id },
  { name: "Dr. Bhaskar Deka", email: "bhaskar@gauhati.ac.in", deptId: deptECE.id },
];

  const teachers = [];
  for (const t of teacherUsers) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        name: t.name,
        email: t.email,
        password: hash("teacher123"),
        role: "TEACHER",
      },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, departmentId: t.deptId },
    });
    teachers.push(teacher);
  }
  console.log("✅ Teachers created");

  // ─── Courses ─────────────────────────────────────────────────────────
  const courses = [
    { id: "cmjhfan4k000nuwp4vne02gie", name: "Data Structures and Algorithms", code: "CS-501", entryCode: "DSA501", teacherId: teachers[0].id, semesterId: sem5CSE.id },
    { id: "cmjhfc2bv000ruwp46tw5y3q6", name: "Operating Systems", code: "CS-502", entryCode: "OS5022", teacherId: teachers[1].id, semesterId: sem5CSE.id },
    { id: "cmjhffwhw000xuwp4a9wetdiq", name: "Database Management Systems", code: "CS-503", entryCode: "DBMS03", teacherId: teachers[0].id, semesterId: sem5CSE.id },
    { id: "cmjhfi59p0013uwp4phh6bazf", name: "Computer Networks", code: "IT-501", entryCode: "CN5014", teacherId: teachers[2].id, semesterId: sem5IT.id },
    { id: "cmjhfjbal0017uwp4f068vsfb", name: "Software Engineering", code: "IT-502", entryCode: "SE5025", teacherId: teachers[3].id, semesterId: sem5IT.id },
  ];

  for (const c of courses) {
    await prisma.course.upsert({
      where: { id: c.id },
      update: {},
      create: c,
    });
  }
  console.log("✅ Courses created");

  // ─── Students ────────────────────────────────────────────────────────
  const studentData = [
    { id: "cmjmoth65000huw68ccd5lcum", name: "Arjun Gautam Baruah", email: "arjun.baruah@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmoti6n000kuw6833e9g8fr", name: "Shubrajit Deb", email: "shubrajit.deb@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotirp000nuw68id39qyhh", name: "Monaswi Kumar Bharadwaj", email: "monaswi.bharadwaj@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotjb8000quw68xhfdwm78", name: "Liza Kalita", email: "liza.kalita@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotjvx000tuw68op9coyz1", name: "Bikash Nath", email: "bikash.nath@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotkfp000wuw68qz9bsq2s", name: "Sikhar Kashyap Jyoti", email: "sikhar.jyoti@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotkz8000zuw68ill1bls5", name: "Bikash Bora", email: "bikash.bora@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotlii0012uw6852e1cgvs", name: "Abhishek Roy", email: "abhishek.roy@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotm1v0015uw68sq6vm3kl", name: "Binit Krishna Goswami", email: "binit.goswami@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmotmli0018uw6849d5t2tg", name: "Abhiraj Chakraborty", email: "abhiraj.chakraborty@gauhati.ac.in", programId: progBTechCSE.id },
    { id: "cmjmozqoi001buw68v2kq5vkq", name: "Abhick Dey", email: "abhick.dey@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmozs79001euw68l7msny2x", name: "Rishab Kalita", email: "rishab.kalita@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmozspz001huw6865e7z8ja", name: "Pratiksha Sarma", email: "pratiksha.sarma@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmozt8s001kuw682c5ohejr", name: "Geetartha Bordoloi", email: "geetartha.bordoloi@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmozuc3001nuw68t3gikoeq", name: "Ashmit Karmakar", email: "ashmit.karmakar@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmozuy3001quw681bktrj6n", name: "Kaushik Sarma", email: "kaushik.sarma@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmp3j9e001tuw68p5vrat7j", name: "Prasun Chakraborty", email: "prasun.chakraborty@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmp3nqr001wuw68rhiuoz5l", name: "Shweta Dey", email: "shweta.dey@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjmp3o98001zuw686r7i6uqi", name: "Purab Jyoti Kashyap", email: "purab.kashyap@gauhati.ac.in", programId: progBTechIT.id },
    { id: "cmjolble20002uww4eeqi9nej", name: "Arijit Banik", email: "arijit.banik@gauhati.ac.in", programId: progBTechIT.id },
  ];

  for (const s of studentData) {
    // Create User first with the student's name-based ID
    const userId = s.id + "_user";
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        // Default password = DOB format stripped: use 00000000 as placeholder
        password: hash("00000000"),
        role: "STUDENT",
      },
    });

    // Create Student with exact ID from dataset
    await prisma.student.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        userId: user.id,
        programId: s.programId,
        status: "active",
      },
    });
  }
  console.log("✅ Students created");

  // ─── Enroll students in courses ──────────────────────────────────────
  const cseStudentIds = studentData.slice(0, 10).map(s => s.id);
  const itStudentIds = studentData.slice(10).map(s => s.id);
  const cseCoursIds = courses.slice(0, 3).map(c => c.id);
  const itCourseIds = courses.slice(3).map(c => c.id);

  for (const studentId of cseStudentIds) {
    for (const courseId of cseCoursIds) {
      await prisma.course.update({
        where: { id: courseId },
        data: { students: { connect: { id: studentId } } },
      });
    }
  }

  for (const studentId of itStudentIds) {
    for (const courseId of itCourseIds) {
      await prisma.course.update({
        where: { id: courseId },
        data: { students: { connect: { id: studentId } } },
      });
    }
  }
  console.log("✅ Students enrolled in courses");

  // ─── Attendance ──────────────────────────────────────────────────────
  const existing = await prisma.attendance.findFirst();
  if (existing) {
    console.log("⚠️ Attendance already seeded. Skipping...");
  } else {
    const attendanceRates = {
      "cmjmoth65000huw68ccd5lcum": 0.95,
      "cmjmoti6n000kuw6833e9g8fr": 0.92,
      "cmjmotirp000nuw68id39qyhh": 0.88,
      "cmjmotjb8000quw68xhfdwm78": 0.82,
      "cmjmotjvx000tuw68op9coyz1": 0.75,
      "cmjmotkfp000wuw68qz9bsq2s": 0.75,
      "cmjmotkz8000zuw68ill1bls5": 0.72,
      "cmjmotlii0012uw6852e1cgvs": 0.68,
      "cmjmotm1v0015uw68sq6vm3kl": 0.49,
      "cmjmotmli0018uw6849d5t2tg": 0.45,
      "cmjmozqoi001buw68v2kq5vkq": 0.93,
      "cmjmozs79001euw68l7msny2x": 0.91,
      "cmjmozspz001huw6865e7z8ja": 0.85,
      "cmjmozt8s001kuw682c5ohejr": 0.80,
      "cmjmozuc3001nuw68t3gikoeq": 0.75,
      "cmjmozuy3001quw681bktrj6n": 0.70,
      "cmjmp3j9e001tuw68p5vrat7j": 0.65,
      "cmjmp3nqr001wuw68rhiuoz5l": 0.48,
      "cmjmp3o98001zuw686r7i6uqi": 0.42,
      "cmjolble20002uww4eeqi9nej": 0.88,
    };

    function generateClassDates() {
  const dates = [];

  // Start: Jan 1, 2026
  const start = new Date("2026-01-01");

  // End: Today
  const end = new Date();

  const times = ["10:00", "14:00", "16:00"];
  let timeIndex = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();

    // Only Mon, Wed, Fri
    if (day === 1 || day === 3 || day === 5) {
      const dateStr = d.toISOString().split("T")[0];
      const time = times[timeIndex % times.length];

      dates.push(new Date(`${dateStr}T${time}:00.000Z`));
      timeIndex++;
    }
  }

  return dates;
}

    const classDates = generateClassDates();
    let count = 0;

    for (const s of studentData) {
      const studentCourses = cseStudentIds.includes(s.id) ? cseCoursIds : itCourseIds;
      const rate = attendanceRates[s.id] || 0.75;

      for (const courseId of studentCourses) {
        for (const timestamp of classDates) {
          const present = Math.random() < rate;
          await prisma.attendance.create({
            data: {
              studentId: s.id,
              courseId,
              status: present,
              timestamp,
              photoPath: present ? `uploads/attendance/${s.id}_${timestamp.getTime()}.jpg` : null,
            },
          });
          count++;
        }
      }
    }
    console.log(`✅ Attendance seeded: ${count} records`);
  }

  console.log("\n🎉 Seed complete!");
  console.log("📧 Admin login: admin@gauhati.ac.in / admin123");
  console.log("📧 Teacher login: pranab.das@gauhati.ac.in / teacher123");
  console.log("📧 Student login: arjun.baruah@gauhati.ac.in / 00000000");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
