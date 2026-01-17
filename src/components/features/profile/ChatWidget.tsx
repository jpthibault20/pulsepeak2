import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";


export const ChatWidget = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
        { role: 'ai', text: 'Bonjour ! Je suis votre coach Triathlon IA. Besoin d\'aide pour configurer vos zones ou votre emploi du temps ?' }
    ]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll vers le bas
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        const newMsg = { role: 'user' as const, text: input };
        setMessages([...messages, newMsg]);
        setInput('');

        // Simulation réponse IA
        setTimeout(() => {
            setMessages(prev => [...prev, {
                role: 'ai',
                text: "C'est noté. Je prends en compte cette information pour adapter votre plan d'entraînement."
            }]);
        }, 1000);
    };
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-20 right-4 md:right-10 w-[90vw] md:w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300">
            {/* Header Chat */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-bold text-white">Coach IA</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-slate-800 bg-slate-900 rounded-b-xl flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Posez une question..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={handleSend} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors">
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};