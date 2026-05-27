import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STUDENT_EMAIL = "demo-student@homeworkhero.demo";
const WRITER_EMAIL = "demo-writer@homeworkhero.demo";

async function getOrCreateUser(email: string, displayName: string, role: "student" | "writer") {
  // Try find existing
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: crypto.randomUUID() + "Aa1!",
    email_confirm: true,
    user_metadata: { display_name: displayName, role },
  });
  if (error) throw new Error(error.message);
  return data.user!.id;
}

export const seedDemo = createServerFn({ method: "POST" }).handler(async () => {
  const studentId = await getOrCreateUser(STUDENT_EMAIL, "Aarav Sharma (Demo)", "student");
  const writerId = await getOrCreateUser(WRITER_EMAIL, "Priya Verma (Demo)", "writer");

  // Ensure profile roles/bios are set (handle_new_user creates the row)
  await supabaseAdmin.from("profiles").update({
    display_name: "Aarav Sharma (Demo)", role: "student",
    bio: "Class 10 student from Mumbai 📚", rating: 4.8, jobs_completed: 3,
  }).eq("id", studentId);
  await supabaseAdmin.from("profiles").update({
    display_name: "Priya Verma (Demo)", role: "writer",
    bio: "Math & Science tutor, 5+ years experience ✨", rating: 4.9, jobs_completed: 47,
  }).eq("id", writerId);

  // Assignment
  const { data: a, error: aErr } = await supabaseAdmin.from("assignments").insert({
    student_id: studentId,
    title: "Class 10 Algebra worksheet — 15 problems",
    description: "Need help solving 15 quadratic equation problems with full step-by-step working. Due soon!",
    subject: "Math",
    budget_min: 200,
    budget_max: 500,
    deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    status: "open",
  }).select("id").single();
  if (aErr) throw new Error(aErr.message);

  // Bids
  await supabaseAdmin.from("bids").insert([
    { assignment_id: a.id, writer_id: writerId, amount: 350, message: "I can finish this in 4 hours with full working shown." },
    { assignment_id: a.id, writer_id: writerId, amount: 400, message: "Updated offer — includes a short video explanation too!" },
  ]);

  // Chat messages with negotiation
  await supabaseAdmin.from("messages").insert([
    { assignment_id: a.id, sender_id: writerId, receiver_id: studentId, content: "Hi! I'd love to help with your algebra worksheet 👋", offer_amount: null },
    { assignment_id: a.id, sender_id: studentId, receiver_id: writerId, content: "Great! Can you do it for ₹300?", offer_amount: 300 },
    { assignment_id: a.id, sender_id: writerId, receiver_id: studentId, content: "Best I can do is ₹400 with video explanation included.", offer_amount: 400 },
  ]);

  return { ok: true, studentId, writerId, assignmentId: a.id };
});

export const clearDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const demoUsers = list.users.filter((u) => u.email === STUDENT_EMAIL || u.email === WRITER_EMAIL);
  for (const u of demoUsers) {
    // Cascade-clean: messages, bids, assignments tied to these users
    await supabaseAdmin.from("messages").delete().or(`sender_id.eq.${u.id},receiver_id.eq.${u.id}`);
    await supabaseAdmin.from("bids").delete().eq("writer_id", u.id);
    await supabaseAdmin.from("assignments").delete().eq("student_id", u.id);
    await supabaseAdmin.auth.admin.deleteUser(u.id);
  }
  return { ok: true, removed: demoUsers.length };
});
