/**
 * Aufgezeichnete GitHub-Deliveries fuer den Webhook-Empfaenger.
 *
 * Der Core erlaubt nur `.ts` (Tree-Gate), also liegen die Payloads als
 * typisierte Konstanten hier; der Empfaenger liest sie als JSON-Datei, die der
 * Test daraus schreibt. Inhalt unveraendert aus der echten Delivery-Form.
 */

/** `issue_comment` mit gueltigem MERGE_PLAN an #913. */
export const PLAN_DELIVERY = {
  "action": "created",
  "issue": {
    "number": 913,
    "title": "Merge-Queue",
    "state": "open"
  },
  "comment": {
    "id": 6905796238,
    "user": {
      "login": "vannon091118"
    },
    "created_at": "2026-11-16T02:40:48Z",
    "body": "MERGE_PLAN rev=4 hash=6f48c213bf48 main=a07952fe22e9f3c4093ff9133d99d24d3b6c5791 at=2026-11-16T02:52Z\npr=952 head=8832094070376fa0c4d3bace8d5c7ed6f8069b56\n\nQueue-Revision 4: 1 offene PRs, Basis `a07952fe22e9f3c4093ff9133d99d24d3b6c5791`.\nBestaetigung je aktiver Session:\n`pnpm run merge:queue -- --ack --session <session> --role <worker|maintainer>`"
  },
  "repository": {
    "full_name": "vannon091118/rigged-by-design"
  },
  "sender": {
    "login": "vannon091118"
  }
} as const;

/** `pull_request` einer offenen Lane. */
export const PR_DELIVERY = {
  "action": "opened",
  "number": 953,
  "pull_request": {
    "number": 953,
    "state": "open",
    "merged": false,
    "head": {
      "sha": "2c1599b1b2358d4efff3f6ddcf90974311e5b600"
    }
  },
  "repository": {
    "full_name": "vannon091118/rigged-by-design"
  },
  "sender": {
    "login": "vannon091118"
  }
} as const;

/** Offene PRs zum Zeitpunkt der Aufzeichnung. */
export const OPEN_PULLS = [
  {
    "number": 952,
    "headRefOid": "8832094070376fa0c4d3bace8d5c7ed6f8069b56",
    "state": "open"
  }
] as const;

/** Die Event-Namen, die zu den Payloads gehoeren. */
export const EVENTS = { plan: 'issue_comment', pullRequest: 'pull_request' } as const;
