// src/components/home/Footer.jsx
import { Heart, Instagram, Facebook, Mail, MapPin, Phone } from 'lucide-react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4">
        {/* Main footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-16">
          {/* Brand */}
          <div>
            <div className="text-2xl font-extrabold text-white mb-4">
              IdeaFood<span className="text-yellow-500">.</span>
            </div>
            <p className="text-gray-400 leading-relaxed mb-6 max-w-xs">
              Sua plataforma própria de delivery. Sem comissões abusivas, sem intermediários.
            </p>
            <div className="flex gap-4">
              {[
                { Icon: Instagram, href: '#' },
                { Icon: Facebook, href: '#' },
                { Icon: Mail, href: 'mailto:contato@ideafood.com.br' },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-yellow-500 flex items-center justify-center transition-colors duration-300 group"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Links Úteis</h4>
            <ul className="space-y-3">
              {['Sobre Nós', 'Termos de Uso', 'Política de Privacidade', 'Fale Conosco', 'Seja Parceiro'].map(
                (link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-yellow-500 transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Contato</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span>Niterói, Rio de Janeiro, RJ - Brasil</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span>(22) 99981-02575</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span>contato@ideafood.com.br</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <p>
            © {year} IdeaFood. Todos os direitos reservados.
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
