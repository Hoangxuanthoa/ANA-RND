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
