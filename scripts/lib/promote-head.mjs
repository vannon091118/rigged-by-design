/**
 * Der Branch-Kopf ist Daten, kein Code: erst den exakt geprueften Commit
 * holen, sonst den Branch; `HEAD` bleibt der Notausgang.
 */
const FULL_SHA = /^[0-9a-f]{40}$/;

export function createPromotionHead({ git, branch, MAIN, headSha, warn }) {
  let contentRef = 'HEAD';

  const fetchHead = () => {
    if (!branch || branch === MAIN) return;
    if (FULL_SHA.test(headSha)) {
      if (git(['fetch', 'origin', `+${headSha}:refs/rbd/promote-head`]) !== null) {
        contentRef = 'refs/rbd/promote-head';
        return;
      }
      warn(`geprueften Kopf ${headSha} nicht abrufbar; kein Merge auf Verdacht`);
    }
    if (git(['fetch', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]) === null) {
      warn(`Kopf ${branch} nicht abrufbar; PR-Text bleibt beim lokalen Stand`);
      return;
    }
    contentRef = `origin/${branch}`;
  };

  const headRef = () => contentRef;
  const exactHead = () => FULL_SHA.test(headSha) && git(['rev-parse', '--verify', 'refs/rbd/promote-head']) === headSha;

  return { fetchHead, headRef, exactHead };
}
