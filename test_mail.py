#!/usr/bin/env python
"""Find out whether this server can send mail at all, and why not if it can't.

    python test_mail.py                      # probe the ports, then try a real send
    python test_mail.py you@example.com      # send the test to a specific address

Run it before switching ADMIN_OTP_ENABLED back on — it reports the actual
SMTP error, instead of leaving you to discover it at the login screen.
"""
import os
import smtplib
import socket
import ssl
import sys

PROBES = [(587, "STARTTLS"), (465, "SSL"), (25, "plain")]


def probe(host, port, kind, timeout=10):
    """Can we even open an SMTP conversation on this port?"""
    try:
        if kind == "SSL":
            s = smtplib.SMTP_SSL(host, port, timeout=timeout,
                                 context=ssl.create_default_context())
        else:
            s = smtplib.SMTP(host, port, timeout=timeout)
            if kind == "STARTTLS":
                s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.quit()
        return True, ""
    except (socket.timeout, TimeoutError):
        return False, "timed out — the port is most likely blocked by the host"
    except ConnectionRefusedError:
        return False, "connection refused"
    except smtplib.SMTPServerDisconnected as e:
        return False, f"server closed the connection ({e or 'no detail'}) — usually a blocked port"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def main():
    def env(*names, default=""):
        for n in names:
            v = os.environ.get(n)
            if v:
                return v
        return default

    host = env("MAIL_SERVER", "SMTP_SERVER", default="smtp.gmail.com")
    user = env("MAIL_USERNAME", "SMTP_EMAIL", "SMTP_USERNAME")
    pwd  = env("MAIL_PASSWORD", "SMTP_PASSWORD")
    want = int(env("MAIL_PORT", "SMTP_PORT", default="587"))

    print(f"Server   : {host}")
    print(f"Username : {user or '(not set in the environment — app.py falls back to its built-in account)'}")
    print(f"Password : {'set, ' + str(len(pwd)) + ' chars' if pwd else '(not set — using the built-in fallback)'}")
    print()

    print("Reachability")
    order = sorted(PROBES, key=lambda pk: pk[0] != want)   # the configured port first
    reachable = []
    for port, kind in order:
        ok, err = probe(host, port, kind)
        print(f"  {port:<5} {kind:<9} {'OK' if ok else 'FAILED — ' + err}")
        if ok:
            reachable.append((port, kind))

    if not reachable:
        print("\nNo SMTP port is reachable from this server.")
        print("Almost always the hosting provider blocking outbound mail. Either ask them")
        print("to open 587/465, or send through an email API over HTTPS (Brevo, SendGrid,")
        print("Mailgun) — port 443 is never blocked.")
        return 2

    print()
    print("Authenticated send")
    if not (user and pwd):
        from app import app as flask_app
        user = user or flask_app.config.get("MAIL_USERNAME")
        pwd  = pwd or flask_app.config.get("MAIL_PASSWORD")

    to = sys.argv[1] if len(sys.argv) > 1 else user
    for port, kind in reachable:
        try:
            if kind == "SSL":
                s = smtplib.SMTP_SSL(host, port, timeout=20,
                                     context=ssl.create_default_context())
            else:
                s = smtplib.SMTP(host, port, timeout=20)
                if kind == "STARTTLS":
                    s.starttls(context=ssl.create_default_context())
            s.login(user, pwd)
            s.sendmail(user, [to],
                       f"Subject: Attendance Portal mail test\r\n"
                       f"From: {user}\r\nTo: {to}\r\n\r\n"
                       f"If you are reading this, mail works on port {port} ({kind}).\r\n")
            s.quit()
            print(f"  {port} ({kind}): SENT to {to}")
            print()
            if port != want:
                print(f"Put this in .env so the app uses the port that works:")
                print(f"  MAIL_PORT={port}")
                print(f"  MAIL_USE_SSL={'1' if kind == 'SSL' else '0'}")
            return 0
        except smtplib.SMTPAuthenticationError as e:
            print(f"  {port} ({kind}): AUTH REJECTED — {e.smtp_code} {e.smtp_error}")
            print("    The account or app password is wrong, or Google revoked it.")
        except Exception as e:
            print(f"  {port} ({kind}): {type(e).__name__}: {e}")

    print("\nA port was reachable but the send failed — see the errors above.")
    return 3


if __name__ == "__main__":
    sys.exit(main())
