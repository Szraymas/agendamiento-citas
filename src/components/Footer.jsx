import React from 'react';
import { Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-text">
          <span>&copy; {currentYear}</span>
          <span className="footer-divider">•</span>
          <span>
            Hecho con <Heart size={14} className="footer-heart" /> por{' '}
            <a
              href="https://www.linkedin.com/in/felipe-suárez-másmela-019974253/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-author-link"
              title="Perfil de LinkedIn de Felipe Suárez Másmela"
            >
              Felipe Suárez Másmela
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}
