"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "工作台" },
  { href: "/debug", label: "执行控制台" },
  { href: "/history", label: "历史回放" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="site-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`site-nav-link${pathname === link.href ? " is-active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
