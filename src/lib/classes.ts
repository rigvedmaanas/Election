export const schoolClasses = Array.from({ length: 8 }, (_, index) => {
  const grade = index + 5;

  return ["A", "B", "C"].map((section) => `Class ${grade}${section}`);
}).flat();
