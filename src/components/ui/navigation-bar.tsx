
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogIn, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function NavigationBar() {
  const { user, session } = useAuth();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
    } catch (error: any) {
      toast.error(`Sign out failed: ${error.message}`);
    }
  };

  return (
    <nav className="flex items-center justify-between p-4 w-full">
      <Link to="/" className="text-xl font-bold text-primary">
        AI Game Creator
      </Link>
      
      <div className="flex items-center gap-2">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-300">
              {user.email?.split('@')[0]}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="flex items-center gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex items-center gap-2" 
              asChild
            >
              <Link to="/profile">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </Button>
          </div>
        ) : (
          <Button 
            variant="default" 
            size="sm"
            asChild
            className="flex items-center gap-2"
          >
            <Link to="/auth">
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
