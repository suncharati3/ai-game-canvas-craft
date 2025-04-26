
import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Code, Settings, FileText, Gamepad, Image, Layout, Layers, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

interface EditorHeaderProps {
  onSave: () => void;
  onCodeView: () => void;
  onSettingsView: () => void;
  onFilesView: () => void;
  isSaving?: boolean;
  activeTab?: string;
}

export function EditorHeader({
  onSave,
  onCodeView,
  onSettingsView,
  onFilesView,
  isSaving = false,
  activeTab = "dashboard"
}: EditorHeaderProps) {
  return (
    <header className="p-4 border-b border-slate-800 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        
        <h1 className="text-xl font-bold game-gradient-text hidden sm:block">Game Editor</h1>
      </div>

      <Menubar className="hidden md:flex">
        <MenubarMenu>
          <MenubarTrigger className="font-bold">File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Project
              <MenubarShortcut>⌘S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onFilesView}>
              <FileText className="h-4 w-4 mr-2" />
              View Files
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="font-bold">View</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onCodeView}>
              <Code className="h-4 w-4 mr-2" />
              Code Editor
            </MenubarItem>
            <MenubarItem>
              <Layout className="h-4 w-4 mr-2" />
              Toggle Layout
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="font-bold">Assets</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Image className="h-4 w-4 mr-2" />
              Sprite Library
            </MenubarItem>
            <MenubarItem>
              <Layers className="h-4 w-4 mr-2" />
              3D Models
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="font-bold">Game</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Gamepad className="h-4 w-4 mr-2" />
              Test Game
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={onSettingsView}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <div className="md:hidden">
        <Button variant="outline" size="sm" onClick={() => {}}>
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
