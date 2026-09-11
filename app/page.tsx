import { Dashboard } from "@/components/dashboard";
import { INITIAL_TASKS } from "@/lib/tasks";

export default function Home() {
  return <Dashboard initialTasks={INITIAL_TASKS} />;
}
