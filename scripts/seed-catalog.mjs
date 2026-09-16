// One-off seed: real company reference data (Customers, Category/
// Material/Size/Color lookup lists) — the taxonomy Products needs to
// exist before anyone can create a real product, unlike Products/
// Projects/etc. themselves which start empty for real usage. Values
// taken from the app's own mock-data.ts (CUSTOMERS/CATEGORIES/MATERIALS/
// SIZES/COLORS) — real company data, not demo content.
// Safe to re-run: skips any name that already exists.
//
// Usage: node --env-file=.env scripts/seed-catalog.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CUSTOMERS = ["JYSK", "ADE", "SCG", "Habitat"];
const CATEGORIES = ["Storage", "Lighting", "Decor", "Kitchen & Bath", "Planter"];
const MATERIALS = ["Rattan", "Bamboo", "Water Hyacinth", "Seagrass", "Jute"];
const SIZES = ["XS", "SM", "ME", "LG", "XL"];
const COLORS = ["Tự nhiên", "Nâu nhạt", "Nâu đậm", "Trắng", "Đen"];

async function seedNames(label, names, model) {
  for (const name of names) {
    const existing = await model.findFirst({ where: { name } });
    if (existing) {
      console.log(`= ${label} "${name}" — already exists`);
      continue;
    }
    await model.create({ data: { name } });
    console.log(`+ ${label} "${name}" — created`);
  }
}

async function main() {
  await seedNames("Customer", CUSTOMERS, prisma.customer);
  await seedNames("Category", CATEGORIES, prisma.category);
  await seedNames("Material", MATERIALS, prisma.material);
  await seedNames("Size", SIZES, prisma.size);
  await seedNames("Color", COLORS, prisma.color);
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
