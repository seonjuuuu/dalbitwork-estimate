import { useEstimate } from '@/contexts/EstimateContext';
import { FilePlus, FileText, List, ChevronLeft, ChevronRight, FileCheck, LogOut, User, BookOpen, BarChart3, Boxes, Building2, LayoutDashboard, Globe, CalendarDays, KanbanSquare, FolderOpen, Search } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';

const SYMBOL_LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663381204565/fPgwdiJ6bkDvqhYoiMKGTH/dalbitwork-symbol_6be6c49b.webp';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [location, navigate] = useLocation();
  const { newDocument, currentDoc } = useEstimate();
  const { user, logout } = useAuth();

  // 현재 편집 중인 문서 타입으로 활성 상태 판단
  const isOnEditor = location === '/editor';
  const isProposalActive = isOnEditor && currentDoc.type === 'proposal';
  const isEstimateActive = isOnEditor && currentDoc.type === 'estimate';

  const navItems = [
    {
      icon: LayoutDashboard,
      label: '대시보드',
      id: 'dashboard',
      active: location === '/',
      onClick: () => navigate('/'),
    },
    {
      icon: FilePlus,
      label: '새 제안서',
      id: 'new-proposal',
      active: isProposalActive,
      onClick: () => {
        newDocument('proposal');
        navigate('/editor');
      },
    },
    {
      icon: FileCheck,
      label: '새 견적 및 계약서',
      id: 'new-estimate',
      active: isEstimateActive,
      onClick: () => {
        newDocument('estimate');
        navigate('/editor');
      },
    },
    {
      icon: FileText,
      label: '제안서 목록',
      id: 'proposal-list',
      active: location === '/proposals',
      onClick: () => navigate('/proposals'),
    },
    {
      icon: List,
      label: '견적 및 계약서 목록',
      id: 'estimate-list',
      active: location === '/estimates',
      onClick: () => navigate('/estimates'),
    },
    {
      icon: BookOpen,
      label: '참고사항 템플릿',
      id: 'note-templates',
      active: location === '/templates',
      onClick: () => navigate('/templates'),
    },
    {
      icon: Boxes,
      label: '서비스 항목',
      id: 'service-items',
      active: location === '/services',
      onClick: () => navigate('/services'),
    },
    {
      icon: Building2,
      label: '고객사 관리',
      id: 'clients',
      active: location === '/clients',
      onClick: () => navigate('/clients'),
    },
    {
      icon: KanbanSquare,
      label: '프로젝트 현황',
      id: 'kanban',
      active: location === '/kanban',
      onClick: () => navigate('/kanban'),
    },
    {
      icon: FolderOpen,
      label: '내 PDF 파일',
      id: 'my-pdfs',
      active: location === '/my-pdfs',
      onClick: () => navigate('/my-pdfs'),
    },
    {
      icon: CalendarDays,
      label: '일정 캘린더',
      id: 'calendar',
      active: location === '/calendar',
      onClick: () => navigate('/calendar'),
    },
    {
      icon: BarChart3,
      label: '월별 매출',
      id: 'monthly-sales',
      active: location === '/sales',
      onClick: () => navigate('/sales'),
    },
    {
      icon: Globe,
      label: 'HKTB 번역 Invoice',
      id: 'hktb-invoice',
      active: location === '/hktb-invoice',
      onClick: () => navigate('/hktb-invoice'),
    },
    {
      icon: Globe,
      label: 'HKTB 관리용 Invoice',
      id: 'hktb-retainer',
      active: location === '/hktb-retainer',
      onClick: () => navigate('/hktb-retainer'),
    },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <aside
      className={`relative flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <img src={SYMBOL_LOGO_URL} alt="달빛워크" className="w-8 h-8 object-contain flex-shrink-0" />
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
            달빛워크
          </span>
        )}
      </div>

      {/* 통합 검색 */}
      <div className="px-2 pt-3">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground border border-border hover:bg-accent hover:text-foreground transition-colors ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>검색</span>}
          </span>
          {!collapsed && <span className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 py-0.5">⌘K</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {/* 대시보드 */}
        {navItems.slice(0, 1).map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              item.active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-border" />

        {/* Section: 작성 */}
        {!collapsed && (
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            작성
          </p>
        )}
        {navItems.slice(1, 3).map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              item.active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-border" />

        {/* Section: 관리 */}
        {!collapsed && (
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            관리
          </p>
        )}
        {navItems.slice(3, 11).map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              item.active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-border" />

        {/* Section: 분석 */}
        {!collapsed && (
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            분석
          </p>
        )}
        {navItems.slice(11).map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              item.active
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* User & Footer */}
      <div className="px-3 py-3 border-t border-border space-y-2">
        {user && (
          <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user.name || user.email?.split('@')[0] || '사용자'}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
              title="로그아웃"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!collapsed && (
          <p className="text-[11px] text-muted-foreground">
            DALBIT WORK
          </p>
        )}
      </div>
    </aside>
  );
}
