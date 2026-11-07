"""Testes de ingest/adventist_pd.py: divisão em parágrafos com notas de página (page_notes). Precisa do pysword
(ingest/refparse.py); sem ele, o teste é pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import ingest.adventist_pd as A  # noqa: E402
except ImportError:  # pysword ausente no python3 do sistema
    A = None


def obra(page_notes: bool):
    return A.Work("teste-obra", "Teste", "Teste", "ed.", "u", "u", "x.txt", "archive", r"(?!)", None,
                  "direitos", page_notes=page_notes)


@unittest.skipIf(A is None, "pysword ausente (ingest/refparse.py)")
class NotaDePaginaTest(unittest.TestCase):
    # Página termina com a nota "Zech. 9:16, 17." e a frase continua na página seguinte, em minúscula.
    CORPO = ("the Lord's inheritance was given to the faithful and true in every age\n\n"
             "Zech. 9:16, 17.\n\n"
             "of His grace in His kindness toward us through Christ Jesus.")

    def test_continuacao_volta_ao_paragrafo_de_prosa(self):
        out = A.paragraphs(self.CORPO, obra(page_notes=True))
        textos = [t for _, t in out]
        self.assertEqual(len(textos), 2)
        self.assertTrue(textos[0].endswith("of His grace in His kindness toward us through Christ Jesus."))
        self.assertEqual(textos[1], "Zech. 9:16, 17.")

    def test_sem_a_marca_a_continuacao_cola_na_nota(self):
        # Comportamento antigo (smith-daniel, egw-thoughts): preservado para não mudar o que já está publicado.
        out = A.paragraphs(self.CORPO, obra(page_notes=False))
        textos = [t for _, t in out]
        self.assertEqual(len(textos), 2)
        self.assertTrue(textos[1].startswith("Zech. 9:16, 17. of His grace"))


if __name__ == "__main__":
    unittest.main()
