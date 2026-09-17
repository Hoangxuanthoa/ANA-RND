import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Every real mutation route that used to (in the mock) call the
// client-side addNotification() calls this instead, right alongside its
// own Prisma write — a real Notification row, addressed by userId, not
// a display-name string. `link` is optional since a couple of mock call
// sites never actually set one.
export async function notify(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });
}

// A few events (a new project created, a new product added to one) are
// meant for Admin team-wide awareness, not one specific owner/assignee —
// there can be more than one real Admin account, so this notifies every
// one of them rather than picking an arbitrary "first" admin the way a
// single-recipient lookup would. `excludeUserIds` skips an Admin who's
// either the one who caused the event, or already covered by a separate,
// more specific notification for the same event (e.g. the project's
// creator, who gets their own "please review" notice elsewhere).
export async function notifyAllAdmins(
  input: { type: NotificationType; title: string; message: string; link?: string },
  excludeUserIds: (string | undefined)[] = [],
) {
  const exclude = new Set(excludeUserIds.filter((id): id is string => !!id));
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.filter((a) => !exclude.has(a.id)).map((a) => notify({ ...input, userId: a.id })),
  );
}

// A comment/feedback thread can have more than one real stakeholder
// (e.g. a project's creator AND its R&D owner, or a photo's uploader AND
// the project's creator) — this notifies whichever of `userIds` aren't
// in `excludeUserIds` (typically just the commenter themselves), deduped,
// instead of picking one arbitrary recipient the way a single lookup would.
export async function notifyMany(
  input: { type: NotificationType; title: string; message: string; link?: string },
  userIds: (string | undefined)[],
  excludeUserIds: (string | undefined)[] = [],
) {
  const exclude = new Set(excludeUserIds.filter((id): id is string => !!id));
  const recipients = new Set(userIds.filter((id): id is string => !!id && !exclude.has(id)));
  await Promise.all([...recipients].map((userId) => notify({ ...input, userId })));
}
