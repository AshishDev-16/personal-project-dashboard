import {
  cookies,
} from "next/headers";

import {
  redirect,
} from "next/navigation";

import {
  Dashboard,
} from "@/components/dashboard";

import {
  SessionBoundary,
} from "@/components/session-boundary";

import {
  INITIAL_TASKS,
} from "@/lib/tasks";

import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";


export default async function Home() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE
    )?.value;


  const session =
    await verifySessionToken(
      token
    );


  if (!session) {
    redirect("/login");
  }


  return (
    <SessionBoundary
      expiresAt={
        session.exp
      }
    >
      <Dashboard
        initialTasks={
          INITIAL_TASKS
        }
      />
    </SessionBoundary>
  );
}