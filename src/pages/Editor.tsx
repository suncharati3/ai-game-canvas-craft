import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { GamePreview } from "@/components/editor/game-preview";
import { ChatInterface } from "@/components/editor/chat-interface";
import { EditorHeader } from "@/components/editor/editor-header";
import { useProject } from "@/hooks/useProject";
import { AIGeneration } from "@/components/editor/ai-generation";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const generateGameCode = (): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Game Preview</title>
  <style>
    body { margin: 0; overflow: hidden; }
    canvas { display: block; }
    #info {
      position: absolute;
      top: 10px;
      width: 100%;
      text-align: center;
      color: white;
      font-family: sans-serif;
    }
  </style>
</head>
<body>
  <div id="info">Use WASD keys to move the cube</div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    // Set up scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    
    // Set up camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    
    // Set up renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Create player cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({ color: 0x9b87f5 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    
    // Handle keyboard input
    const keys = { w: false, a: false, s: false, d: false };
    document.addEventListener('keydown', (e) => {
      if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = true;
      }
    });
    document.addEventListener('keyup', (e) => {
      if (keys.hasOwnProperty(e.key.toLowerCase())) {
        keys[e.key.toLowerCase()] = false;
      }
    });
    
    // Game loop
    function animate() {
      requestAnimationFrame(animate);
      
      // Handle movement
      if (keys.w) cube.position.y += 0.05;
      if (keys.s) cube.position.y -= 0.05;
      if (keys.a) cube.position.x -= 0.05;
      if (keys.d) cube.position.x += 0.05;
      
      // Animate cube
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      renderer.render(scene, camera);
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start animation loop
    animate();
  </script>
</body>
</html>
  `;
};

const initialMessages: Message[] = [
  {
    id: "1",
    content: "Welcome to the Game Editor! I'll help you build your game.",
    isUser: false,
    timestamp: new Date()
  },
  {
    id: "2",
    content: "I've generated a basic game with WASD movement controls. Try running it and then you can ask me to make changes.",
    isUser: false,
    timestamp: new Date()
  }
];

const Editor = () => {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const navigate = useNavigate();
  const { project, isLoading, saveProject } = useProject(projectId);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isRunning, setIsRunning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [gameCode, setGameCode] = useState<string>("");
  
  useEffect(() => {
    if (!projectId) {
      toast.error("No project selected. Redirecting to projects page...");
      navigate("/projects");
      return;
    }
  }, [projectId, navigate]);
  
  useEffect(() => {
    if (project?.game_code) {
      setGameCode(project.game_code);
    }
  }, [project]);
  
  const handleToggleRunning = () => {
    setIsRunning(prevState => !prevState);
    if (!isRunning) {
      toast.success("Game preview started!");
    }
  };
  
  const handleSaveProject = async () => {
    try {
      await saveProject({
        game_code: gameCode
      });
    } catch (error: any) {
      toast.error(`Failed to save project: ${error.message}`);
    }
  };
  
  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I'll implement your request: "${message}". For now, this is a demo with pre-built responses.`,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      toast.error("Failed to process your request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading project...</div>;
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EditorHeader
        onSave={handleSaveProject}
        onCodeView={() => setActiveTab("code")}
        onSettingsView={() => setActiveTab("settings")}
        onFilesView={() => setActiveTab("files")}
        isSaving={false}
        activeTab={activeTab}
      />
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
        <div className="md:col-span-8 h-[calc(100vh-130px)]">
          <GamePreview 
            isRunning={isRunning} 
            onToggleRunning={handleToggleRunning}
            previewCode={gameCode}
          />
          <AIGeneration />
        </div>
        
        <div className="md:col-span-4 h-[calc(100vh-130px)]">
          <ChatInterface
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            messages={messages}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
