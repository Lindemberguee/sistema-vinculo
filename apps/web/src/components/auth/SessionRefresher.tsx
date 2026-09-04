"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/** Fire a one-off JWT refresh so a freshly changed session claim (e.g. e-mail
 * verified, invitation accepted) is reflected without a re-login. */
export function SessionRefresher() {
  const { update } = useSession();
  useEffect(() => {
    void update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
