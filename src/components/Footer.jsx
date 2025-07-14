function Footer() {
  return (
    // Usando var(--marrom-escuro) para o fundo (que agora é um preto/cinza escuro)
    // e text-[var(--bege-claro)] para o texto (que é um creme claro),
    // ou simplesmente text-white para um contraste mais forte.
    <footer className="py-6 text-center text-[var(--vermelho] text-sm sm:text-base">
      <p>&copy; 2025 DeuFome. Todos os direitos reservados.</p>
    </footer>
  );
}

export default Footer;