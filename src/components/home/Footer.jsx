// src/components/home/Footer.jsx
import { Heart, Instagram, Facebook, Mail, MapPin, Phone } from 'lucide-react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950/80 border-t border-white/5 backdrop-blur-md text-slate-350">
      <div className="container mx-auto px-4">
        {/* Main footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-16">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 text-2xl font-extrabold text-white mb-4">
              <img src="/logo-idea-solucoes-transp.png" alt="Idea System Logo" className="h-8 w-auto brightness-0 invert" />
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Idea System</span>
            </div>
            <p className="text-slate-400 leading-relaxed mb-6 max-w-xs text-sm font-medium">
              Sua plataforma própria de gestão, PDV, WMS e vendas. Sem taxas abusivas, com controle total do seu negócio.
            </p>
            <div className="flex gap-4">
              {[
                { Icon: Instagram, href: '#' },
                { Icon: Facebook, href: '#' },
                { Icon: Mail, href: 'mailto:contato@ideasystem.com.br' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-white/5 hover:border-orange-500/35 flex items-center justify-center transition-colors duration-300 group"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon className="w-5 h-5 text-slate-400 group-hover:text-orange-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Links Úteis</h4>
            <ul className="space-y-3">
              {[
                { label: 'Fale Conosco', href: 'https://wa.me/5522999812575' },
                { label: 'Seja Parceiro', href: 'mailto:contato@ideasystem.com.br' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-orange-400 transition-colors text-sm font-medium"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Contato</h4>
            <ul className="space-y-4 text-sm text-slate-400 font-medium">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-450 mt-0.5 flex-shrink-0" />
                <span>Bom Jardim, RJ - Brasil</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-orange-455 flex-shrink-0" />
                <span>(22) 99981-2575</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-orange-455 flex-shrink-0" />
                <span>contato@ideasystem.com.br</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium">
          <p>
            © {year} Idea System. Todos os direitos reservados.
          </p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            Feito com <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> no Brasil
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
