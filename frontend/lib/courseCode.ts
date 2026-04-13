// lib/courseCode.ts

// Turn "Information Technology" -> "IT", "Computer Science and Engineering" -> "CSE"
export function getDeptCode(deptName: string | undefined | null): string {
  if (!deptName) return "GEN";

  const stopWords = ["and", "of", "department", "dept.", "dept"];
  const words = deptName
    .split(/\s+/)
    .filter((w) => !stopWords.includes(w.toLowerCase()));

  if (words.length === 0) return "GEN";

  if (words.length === 1) {
    const w = words[0].replace(/[^a-zA-Z]/g, "");
    if (w.length >= 3) return w.slice(0, 3).toUpperCase();
    return w.toUpperCase();
  }

  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// IT-701 style code
export async function generateCourseCode(opts: {
  prisma: any;
  programId: string;
  semesterNumber: number;
}) {
  const { prisma, programId, semesterNumber } = opts;

  // 1) Get department name from program
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { department: true },
  });

  if (!program || !program.department) {
    throw new Error("Program or department not found for course");
  }

  const deptCode = getDeptCode(program.department.name); // e.g. "IT"

  // 2) Count how many courses already exist for this program + semester
  //    (You can also scope by academic year if you want)
  const existingCourses = await prisma.course.count({
    where: {
      semester: {
        academicYear: {
          programId: programId,
        },
        name: {
          equals: `Semester ${semesterNumber}`,
          mode: "insensitive",
        },
      },
    },
  });

  const index = existingCourses + 1; // 1-based
  const indexPart = index.toString().padStart(2, "0"); // 01, 02, ...

  // 3) Final code: IT-701
  return `${deptCode}-${semesterNumber}${indexPart}`;
}
