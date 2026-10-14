import { render, screen } from '@testing-library/react-native';
import Inicio from '@/app/index';
import { t } from '@/i18n';

describe('Inicio', () => {
  it('muestra el nombre de la app desde los textos es-BO', async () => {
    await render(<Inicio />);
    expect(screen.getByRole('header')).toHaveTextContent('UniRide');
  });
});

describe('t()', () => {
  it('devuelve la clave si el texto no existe', () => {
    expect(t('no.existe')).toBe('no.existe');
  });
});
