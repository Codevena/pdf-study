import { useAppStore } from '../../stores/appStore';
import PDFLibrary from '../library/PDFLibrary';
import SearchResults from '../search/SearchResults';
import BookmarkList from '../bookmarks/BookmarkList';
import RecentViews from '../library/RecentViews';

export default function Sidebar() {
  const { sidebarView, setSidebarView, searchResults, pdfs, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-200 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:w-64 lg:w-80
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
      `}>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSidebarView('library')}
          className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
            sidebarView === 'library'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Bibliothek"
        >
          <span className="flex items-center justify-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-[10px] text-gray-400">{pdfs.length}</span>
          </span>
        </button>

        <button
          onClick={() => setSidebarView('search')}
          className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
            sidebarView === 'search'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Suche"
        >
          <span className="flex items-center justify-center gap-1">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchResults.length > 0 && (
              <span className="text-[10px] text-gray-400">{searchResults.length}</span>
            )}
          </span>
        </button>

        <button
          onClick={() => setSidebarView('bookmarks')}
          className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
            sidebarView === 'bookmarks'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Lesezeichen"
        >
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </span>
        </button>

        <button
          onClick={() => setSidebarView('recent')}
          className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
            sidebarView === 'recent'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          title="Zuletzt angesehen"
        >
          <span className="flex items-center justify-center">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </button>
      </div>

      {/* Content - use hidden instead of conditional render to prevent thumbnail reload */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 overflow-y-auto ${sidebarView === 'library' ? '' : 'hidden'}`}>
          <PDFLibrary />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${sidebarView === 'search' ? '' : 'hidden'}`}>
          <SearchResults />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${sidebarView === 'bookmarks' ? '' : 'hidden'}`}>
          <BookmarkList />
        </div>
        <div className={`absolute inset-0 overflow-y-auto ${sidebarView === 'recent' ? '' : 'hidden'}`}>
          <RecentViews />
        </div>
      </div>
      </aside>
    </>
  );
}
