'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, FilePenLine, Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getDocumentProxyUrl } from '@/components/document-preview-content';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

type GoogleDocxEditorActionsProps = {
  fileName: string;
  fileUrl: string;
  contentType?: string | null;
  onSave: (payload: { blob: Blob; fileName: string; contentType: string; sizeBytes: number }) => Promise<void>;
};

let identityServicesPromise: Promise<void> | null = null;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (!identityServicesPromise) {
    identityServicesPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-identity-services') as HTMLScriptElement | null;
      const script = existingScript ?? document.createElement('script');

      script.onload = () => resolve();
      script.onerror = () => {
        identityServicesPromise = null;
        reject(new Error('Non riesco a caricare il servizio di accesso Google.'));
      };

      if (!existingScript) {
        script.id = 'google-identity-services';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  }

  return identityServicesPromise;
}

function requestDriveAccessToken(clientId: string) {
  return new Promise<string>((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) {
      reject(new Error('Il servizio di accesso Google non è disponibile.'));
      return;
    }

    const tokenClient = oauth.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Accesso a Google Drive non riuscito.'));
          return;
        }

        resolve(response.access_token);
      },
      error_callback: error => reject(new Error(error.message || 'Accesso a Google Drive non riuscito.')),
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function getGoogleError(response: Response) {
  const result = await response.json().catch(() => null) as { error?: { message?: string } | string } | null;
  if (typeof result?.error === 'string') return result.error;
  return result?.error?.message || `Richiesta Google non riuscita (${response.status}).`;
}

export function GoogleDocxEditorActions({ fileName, fileUrl, contentType, onSave }: GoogleDocxEditorActionsProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [driveFileUrl, setDriveFileUrl] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'opening' | 'saving' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    let active = true;
    void loadGoogleIdentityServices()
      .then(() => {
        if (active) setIsGoogleReady(true);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Servizio Google non disponibile.');
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  const getAccessToken = async () => {
    if (accessToken) return accessToken;
    if (!clientId) throw new Error('Configurazione Google Drive non disponibile.');

    const token = await requestDriveAccessToken(clientId);
    setAccessToken(token);
    return token;
  };

  const openInGoogleDocs = async () => {
    const editorTab = window.open('about:blank', '_blank');
    if (!editorTab) {
      setError('Consenti l’apertura di nuove schede per usare Google Docs.');
      return;
    }

    editorTab.opener = null;
    setBusyAction('opening');
    setError(null);
    setMessage(null);

    try {
      const token = await getAccessToken();
      const sourceResponse = await fetch(getDocumentProxyUrl({ fileName, fileUrl, contentType }, 'inline'));
      if (!sourceResponse.ok) throw new Error('Non riesco a leggere il documento originale.');
      const sourceBlob = await sourceResponse.blob();
      const boundary = `portal-docx-${crypto.randomUUID()}`;
      const metadata = { name: fileName, mimeType: GOOGLE_DOC_MIME };
      const requestBody = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`,
        sourceBlob,
        `\r\n--${boundary}--`,
      ], { type: `multipart/related; boundary=${boundary}` });
      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: requestBody,
      });

      if (!uploadResponse.ok) throw new Error(await getGoogleError(uploadResponse));
      const driveFile = await uploadResponse.json() as { id?: string; webViewLink?: string };
      if (!driveFile.id) throw new Error('Google Drive non ha restituito l’ID del documento.');

      const editorUrl = driveFile.webViewLink || `https://docs.google.com/document/d/${driveFile.id}/edit`;
      setDriveFileId(driveFile.id);
      setDriveFileUrl(editorUrl);
      editorTab.location.href = editorUrl;
      setMessage('Documento aperto. Google Docs salva automaticamente le modifiche.');
    } catch (reason) {
      editorTab.close();
      setError(reason instanceof Error ? reason.message : 'Non riesco ad aprire il documento in Google Docs.');
    } finally {
      setBusyAction(null);
    }
  };

  const saveToPortal = async () => {
    if (!driveFileId) return;

    setBusyAction('saving');
    setError(null);
    setMessage(null);

    try {
      const token = await getAccessToken();
      const exportUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}/export`);
      exportUrl.searchParams.set('mimeType', DOCX_MIME);
      const exportResponse = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!exportResponse.ok) throw new Error(await getGoogleError(exportResponse));
      const blob = await exportResponse.blob();
      await onSave({ blob, fileName, contentType: DOCX_MIME, sizeBytes: blob.size });

      const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!deleteResponse.ok) console.warn('Non riesco a rimuovere la copia temporanea da Google Drive.');

      setDriveFileId(null);
      setDriveFileUrl(null);
      setMessage('Modifiche salvate nel portale.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Non riesco a sincronizzare il documento.');
    } finally {
      setBusyAction(null);
    }
  };

  if (!clientId) {
    return <p className="text-xs text-muted-foreground">Imposta NEXT_PUBLIC_GOOGLE_CLIENT_ID per attivare la modifica Word.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {driveFileId ? (
        <>
          <Button asChild type="button" size="sm" variant="outline">
            <a href={driveFileUrl ?? `https://docs.google.com/document/d/${driveFileId}/edit`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Apri Google Docs
            </a>
          </Button>
          <Button type="button" size="sm" onClick={() => void saveToPortal()} disabled={busyAction !== null || !isGoogleReady}>
            {busyAction === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva nel portale
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => void openInGoogleDocs()} disabled={!isGoogleReady || busyAction !== null}>
          {busyAction === 'opening' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePenLine className="mr-2 h-4 w-4" />}
          Modifica in Google Docs
        </Button>
      )}
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}