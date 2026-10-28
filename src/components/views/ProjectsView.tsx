import React, { useState, useMemo } from 'react';
import { Project, Task, ProjectStatus } from '../../types';
import { Plus, Calendar, CheckSquare, ChevronRight } from 'lucide-react';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProjectModal: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  onSelectProject,
  onOpenNewProjectModal
}) => {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, statusFilter]);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Top Header & Action */}
      <div className="bg-white rounded-2xl p-4 border border-[#F2E2E7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-[#473B40]">프로젝트</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            전체 프로젝트 {projects.length}개
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-0.5 bg-[#F9EBEF] rounded-lg border border-[#ECD0DB]">
            {(
              [
                { id: 'all', label: '전체' },
                { id: 'active', label: '진행 중' },
                { id: 'done', label: '완료' }
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  statusFilter === st.id
                    ? 'bg-white text-[#473B40] font-bold shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenNewProjectModal}
            className="px-3 py-1 text-xs font-semibold text-white bg-[#D98DAA] hover:bg-[#C97996] rounded-lg shadow-2xs transition flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> 새 프로젝트
          </button>
        </div>
      </div>

      {/* Projects List: only project name, progress, due date, done tasks count */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#F2E2E7] shadow-xs">
          <p className="text-xs font-semibold text-stone-500">등록된 프로젝트가 없습니다.</p>
          <button
            onClick={onOpenNewProjectModal}
            className="mt-2.5 px-3 py-1 text-xs font-semibold text-[#D98DAA] hover:underline"
          >
            + 새 프로젝트 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const projTasks = tasks.filter((t) => t.projectId === project.id);
            const doneTasks = projTasks.filter((t) => t.status === 'done').length;

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="group bg-white rounded-2xl p-4 sm:p-5 border border-[#F2E2E7] hover:border-[#D98DAA] shadow-xs transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-sm font-bold text-[#473B40] group-hover:text-[#D98DAA] transition-colors truncate">
                      {project.name}
                    </h2>
                    <span className="text-xs font-mono font-bold text-[#9E5170]">
                      {project.progress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#F9EBEF] rounded-full h-1.5 mb-3 overflow-hidden">
                    <div
                      className="bg-[#D98DAA] h-full rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-400 pt-2 border-t border-stone-100 font-mono">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-stone-600">
                      <CheckSquare className="w-3.5 h-3.5 text-[#D98DAA]" />
                      <strong>{doneTasks}</strong>/{projTasks.length} 완료
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      마감 {project.dueDate}
                    </span>
                  </div>

                  <span className="text-[#D98DAA] group-hover:translate-x-0.5 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
