export const schoolClasses = Array.from({ length: 8 }, (_, index) => {
  const grade = index + 5;

  return ["A", "B", "C"].map((section) => `Class ${grade}${section}`);
}).flat();

export function classToSlug(className: string) {
  return className.replace(/\s+/g, "").replace(/^Class/, "class");
}

export function slugToClass(slug: string) {
  const normalized = slug.toLowerCase();

  return (
    schoolClasses.find((className) => classToSlug(className).toLowerCase() === normalized) ??
    null
  );
}
