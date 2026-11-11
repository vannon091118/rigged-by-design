/** Export, Import und Fehleranzeige des Layout-Editors; kennt kein Layoutwissen. */
import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { worldStore } from '../store/use-world-store';

interface LayoutTransfer {
  readonly issue: string;
  readonly fileInput: RefObject<HTMLInputElement | null>;
  readonly download: () => void;
  readonly loadFile: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly openFile: () => void;
}

export function useLayoutTransfer(): LayoutTransfer {
  const [issue, setIssue] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const download = (): void => {
    const url = URL.createObjectURL(new Blob([worldStore.exportLayout()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rbd-layout.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  const loadFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void file.text().then((text) => {
      const result = worldStore.importLayout(text);
      setIssue(result.ok ? '' : result.issues.join(' '));
    });
  };
  return {
    issue,
    fileInput,
    download,
    loadFile,
    openFile: () => fileInput.current?.click(),
  };
}
