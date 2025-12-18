// 업무 상세 페이지
import TaskDetail from "@/app/components/features/task/TaskDetail";

export default function TasksDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const taskId = params.id;

  return (
    <div>
      <TaskDetail taskId={params.id} />
    </div>
  );
}
