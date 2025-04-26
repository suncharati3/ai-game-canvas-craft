
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handleDelete = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      toast.success("Project deleted successfully");
    } catch (error: any) {
      toast.error(`Failed to delete project: ${error.message}`);
    }
  };

  const handleCreateProject = async () => {
    if (!user) {
      toast.error("You must be logged in to create a project");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: 'New Game Project',
          description: 'A new game project created with AI Game Creator',
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Immediately redirect to editor with the new project ID
      navigate(`/editor?project=${data.id}`);
      toast.success("Project created successfully, redirecting to editor...");
    } catch (error: any) {
      toast.error(`Failed to create project: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Projects</h1>
          <Button onClick={handleCreateProject} className="game-gradient">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center">Loading projects...</div>
        ) : !projects?.length ? (
          <div className="text-center text-muted-foreground">
            <p>No projects yet. Create your first project to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  <CardDescription>
                    {project.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                  >
                    <Link to={`/editor?project=${project.id}`}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
