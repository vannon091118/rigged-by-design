/**
 * Eine Identitaet fuer jeden Commit: unabhaengig von Runner, Sandbox und
 * lokalem `git config`. Wer pusht, aendert nicht, wer als Committer steht.
 */
export const IDENTITY = Object.freeze({
  name: 'Vannon',
  email: 'Schneider.felix1993@gmail.com',
});
