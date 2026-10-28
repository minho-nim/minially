import React, { useState } from 'react';
import { Project, Task } from '../../types';
import { GanttChart } from '../gantt/GanttChart';
import { ArrowLeft, Plus, Calendar, Edit2, ListTodo, BarChart2, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { getPriorityBadge } from '../../utils/dateHelpers';

interface ProjectDetailViewProps {
  project: Project;
  tasks: Task[];
  onBack: () => void;
  onEditProject: (project: Project) => void;
  onOpenNewTaskModal: (projectId?: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onToggleTaskChecklist: (taskId: string, checklistId: string) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  tasks,
  onBack,
  onEditProject,
  onOpenNewTaskModal,
  onEditTask,
  onDeleteTask,
  onToggleTaskStatus
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'gantt'>('tasks');

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneTasksCount = projectTasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Project Summary Header */}
      <div className="bg-white rounded-2xl p-5 border border-[#F2E2E7] shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 프로젝트 목록
          </button>

          <button
            onClick={() => onEditProject(project)}
            className="px-2.5 py-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center gap-1 transition"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#D98DAA]" /> 프로젝트 수정
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#473B40]">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-stone-500 mt-1 max-w-xl">{project.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-stone-400 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D98DAA]" /> 기간: {project.startDate} ~ {project.dueDate}
              </span>
              <span>·</span>
              <span>{doneTasksCount}/{projectTasks.length} 작업 완료</span>
            </div>
          </div>

          {/* Progress bar and percent */}
          <div className="bg-[#FFF8FA] p-3 rounded-xl border border-[#F2E2E7] min-w-[180px]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-stone-600">진행률</span>
              <span className="text-sm font-bold font-mono text-[#9E5170]">
                {project.progress}%
              </span>
            </div>
            <div className="w-full bg-[#F9EBEF] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#D98DAA] h-full rounded-full transition-all duration-300"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: 세부 작업 vs 간트차트 */}
      <div className="flex items-center justify-between gap-3">
        <div className="p-0.5 bg-[#F9EBEF] rounded-lg border border-[#ECD0DB] inline-flex">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-white text-[#473B40] font-bold shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" /> 세부 작업 ({projectTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('gantt')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'gantt'
                ? 'bg-white text-[#473B40] font-bold shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> 간트차트 타임라인
          </button>
        </div>

        {activeTab === 'tasks' && (
          <button
            onClick={() => onOpenNewTaskModal(project.id)}
            className="px-3 py-1 text-xs font-semibold text-white bg-[#D98DAA] hover:bg-[#C97996] rounded-lg shadow-2xs transition flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> 작업 추가
          </button>
        )}
      </div>

      {/* View Content */}
      {activeTab === 'tasks' ? (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#F2E2E7] shadow-xs space-y-2">
          {projectTasks.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              등록된 세부 작업이 없습니다.
              <button
                onClick={() => onOpenNewTaskModal(project.id)}
                className="mt-2 block mx-auto text-xs font-semibold text-[#D98DAA] hover:underline"
              >
                + 새 작업 등록
              </button>
            </div>
          ) : (
            projectTasks.map((task) => {
              const isDone = task.status === 'done';
              const priorityBadge = getPriorityBadge(task.priority);

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-stone-50/70 border-stone-200/70 opacity-60'
                      : 'bg-white hover:bg-[#FFF8FA]/50 border-[#F2E2E7]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleTaskStatus(task.id)}
                        className="text-stone-300 hover:text-[#D98DAA] transition shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-[#D98DAA] fill-[#FFF0F4]" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span
                            className={`text-xs font-medium truncate ${
                              isDone ? 'line-through text-stone-400' : 'text-[#473B40]'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className={`text-[10px] ${priorityBadge.colorClass}`}>
                            {priorityBadge.label}
                          </span>
                        </div>

                        <span className="text-[11px] text-stone-400 font-mono">
                          기간: {task.startDate} ~ {task.dueDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('이 작업을 삭제하시겠습니까?')) {
                            onDeleteTask(task.id);
                          }
                        }}
                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Gantt Chart */
        <GanttChart project={project} tasks={projectTasks} onSelectTask={onEditTask} />
      )}
    </div>
  );
};
