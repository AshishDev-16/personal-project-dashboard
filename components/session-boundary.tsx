"use client";

import {
  useEffect,
  type ReactNode,
} from "react";


export function SessionBoundary({
  expiresAt,
  children,
}: {
  expiresAt: number;

  children: ReactNode;
}) {

  useEffect(() => {
    let loggingOut =
      false;


    async function check() {
      if (
        loggingOut ||
        Date.now() <
          expiresAt
      ) {
        return;
      }

      loggingOut =
        true;

      try {
        await fetch(
          "/api/auth/logout",
          {
            method: "POST",
          }
        );
      } catch {
        // Session is expired
        // regardless.
      }

      window.location.replace(
        "/login?expired=1"
      );
    }


    /*
     * Main exact expiration timer.
     */
    const timeout =
      window.setTimeout(
        () => {
          void check();
        },
        Math.max(
          0,
          expiresAt -
            Date.now()
        )
      );


    /*
     * Extra guard for browser timer
     * throttling / sleeping phones.
     */
    const interval =
      window.setInterval(
        () => {
          void check();
        },
        1000
      );


    function onFocus() {
      void check();
    }


    function onVisibility() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void check();
      }
    }


    window.addEventListener(
      "focus",
      onFocus
    );

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );


    return () => {
      window.clearTimeout(
        timeout
      );

      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        onFocus
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, [expiresAt]);


  return children;
}