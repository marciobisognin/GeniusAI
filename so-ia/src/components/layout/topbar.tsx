"use client";

import { Bell, Search } from "lucide-react";
import { ModeSwitch } from "@/components/layout/mode-switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 backdrop-blur-xl px-4 lg:px-6">
      <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-sm text-muted-foreground w-full max-w-sm cursor-text hover:border-[var(--brand-1)]/40 transition-colors">
        <Search className="size-3.5" />
        <span className="flex-1">Buscar agentes, skills, processos…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ModeSwitch className="hidden sm:flex" />
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-gradient-brand" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer outline-none">
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="bg-gradient-brand text-white text-xs font-medium">
                MB
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Marcio Bisognin</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Meu perfil</DropdownMenuItem>
            <DropdownMenuItem>Preferências</DropdownMenuItem>
            <DropdownMenuItem>Central de ajuda</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
