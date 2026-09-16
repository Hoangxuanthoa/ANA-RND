// One-off seed: creates a real Supabase Auth user + matching `User` row
// (Prisma) for each of the 9 staff members, so real login works before
// real emails/passwords exist. Placeholder @rattanco.vn emails, shared
// temp password — Admin hands these out directly and each person should
// change their password via "Cập nhật thông tin" once they can log in.
// Safe to re-run: skips anyone whose auth user already exists.
//
// Usage: node --env-file=.env scripts/seed-users.mjs
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const TEMP_PASSWORD = "ana-rnd@2026";

const STAFF = [
  { id: "usr-1", name: "Minh", role: "ADMIN", email: "minh@rattanco.vn" },
  { id: "usr-2", name: "Hà", role: "SALES", email: "ha@rattanco.vn" },
  { id: "usr-3", name: "Hùng", role: "SALES", email: "hung@rattanco.vn" },
  { id: "usr-4", name: "Trang", role: "SALES", email: "trang@rattanco.vn" },
  { id: "usr-5", name: "Quân", role: "SALES", email: "quan@rattanco.vn" },
  { id: "usr-6", name: "Ngọc", role: "SALES", email: "ngoc@rattanco.vn" },
  { id: "usr-7", name: "Linh", role: "MARKETING", email: "linh@rattanco.vn" },
  { id: "usr-8", name: "An", role: "RND", email: "an@rattanco.vn" },
  { id: "usr-9", name: "Lan", role: "RND", email: "lan@rattanco.vn" },
];

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const prisma = new PrismaClient();

async function findExistingAuthUser(email) {
  // No getUserByEmail in supabase-js v2 — page through listUsers.
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  for (const staff of STAFF) {
    let authUserId;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: staff.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: staff.name },
    });

    if (error) {
      if (!String(error.message).toLowerCase().includes("already been registered")) {
        console.error(`✗ ${staff.name} (${staff.email}): ${error.message}`);
        continue;
      }
      const existing = await findExistingAuthUser(staff.email);
      if (!existing) {
        console.error(`✗ ${staff.name} (${staff.email}): reported as existing but not found via listUsers`);
        continue;
      }
      authUserId = existing.id;
      console.log(`= ${staff.name} (${staff.email}) — auth user already existed, reusing it`);
    } else {
      authUserId = data.user.id;
      console.log(`+ ${staff.name} (${staff.email}) — created auth user`);
    }

    await prisma.user.upsert({
      where: { id: authUserId },
      update: { fullName: staff.name, email: staff.email, role: staff.role },
      create: { id: authUserId, fullName: staff.name, email: staff.email, role: staff.role },
    });
  }

  console.log(`\nDone. Temp password for all accounts: ${TEMP_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
