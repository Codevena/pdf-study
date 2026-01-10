import { useAppStore } from '../stores/appStore';
import appIcon from '../../../assets/icons/icon.png';

export default function WelcomeScreen() {
  const { setSettings, setPdfs, setIndexingStatus } = useAppStore();

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      const settings = await window.electronAPI.getSettings();
      setSettings(settings);

      // Start indexing
      setIndexingStatus({
        isIndexing: true,
        totalFiles: 0,
        processedFiles: 0,
        currentFile: 'Suche nach PDFs...',
      });

      const pdfs = await window.electronAPI.indexPdfs();
      setPdfs(pdfs);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <div className="w-28 h-28 mx-auto mb-6">
          <img src={appIcon} alt="PDF-Study" className="w-full h-full object-contain drop-shadow-lg" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Willkommen bei PDF-Study
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Durchsuche deine PDF-Sammlung blitzschnell und finde genau die Seite, die du brauchst.
        </p>

        <button
          onClick={handleSelectFolder}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          PDF-Ordner auswählen
        </button>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Wähle einen Ordner mit deinen PDF-Dateien aus.
          <br />
          Alle PDFs werden automatisch indexiert.
        </p>
      </div>
    </div>
  );
}
