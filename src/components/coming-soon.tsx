interface ComingSoonProps {
  title: string;
  description: string;
  icon: string;
  eta?: string;
}

export function ComingSoon({ title, description, icon, eta }: ComingSoonProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-6xl mb-6">{icon}</div>
        <div className="inline-block text-xs font-bold text-aero tracking-widest uppercase mb-4 px-3 py-1 rounded-full border border-aero/30 bg-aero/10">
          Coming Soon
        </div>
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-gray-400 leading-relaxed mb-6 max-w-md mx-auto">{description}</p>
        {eta && (
          <p className="text-xs text-gray-600">Planned for: <span className="text-gray-400">{eta}</span></p>
        )}
      </div>
    </div>
  );
}
