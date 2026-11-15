"""Testes de ingest/comentario_escaneado.py: comentários por versículo de digitalizações do archive.org (djvu.txt).

Os trechos são do próprio OCR do archive.org (Broadus, Commentary on the Gospel of Matthew, commentonmatthew00broauoft),
cortados e com a espaçação original (dois espaços depois de "N.", que é o que distingue marcador de nota).
Precisa do pysword (ingest/refparse.py) e de /usr/share/dict/american-english (auditoria de OCR); sem eles, o teste é
pulado. Rodar a partir da pasta pipeline: python3 -m unittest discover tests
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from ingest import comentario_escaneado as M  # noqa: E402
    from sensus.refs import vid  # noqa: E402
    from ingest.adventist_ocr_audit import DICT_PATH  # noqa: E402
    PRONTO = DICT_PATH.exists()
except ImportError:  # sem pysword
    M = None
    PRONTO = False

# Mt 1: cabeçalho de página, nota de rodapé, cabeçalho de seção e dois comentários (um com a citação de Isa 7:14).
MT1 = """\
CH.  L]

MATTHEW.

1  Or, The genealogy of Jesus Christ 2  Or, birth ;  as iu ver.  18.

Ch.  1:  1-17.  THE GENEALOGY  OF  JESUS
CHRIST.

Matthew begins his Gospel with the genealogy of our Lord.

1.  The  opening  words  signify  either,  Book
of  the  generation,  i.  e.,  descent-book,  pedigree,  genealogy.

2  Abraham  begat  Isaac ;  and  Isaac  begat  Jacob ;

3.     Everywhere  else  in  the  Gospels  it  denotes
the  same  thing,  as  a  note  of  the  first  verse.

2.  Among  the  sons  of  Jacob,  Judas,  or  Ju-
das,  is  the  one  whom  the  evangelist  names  here.

Ch.  1:  18-25.  THE BIRTH OF JESUS.

23.  The  quotation  is  from  Isa.  7 :  14.  Pro
posing  to  give  Ahaz  a  sign  of  speedy  deliver
ance  from  his  enemies,  Ephraim  and  Syria,
the  prophet  speaks  as  here  quoted.
"""


def _comentarios(texto: str, cfg_nome: str = "broadus-matthew"):
    cfg = M.CONFIGS[cfg_nome]
    return M.comentarios(M.limpa_linhas(texto, cfg.pagina), cfg)


@unittest.skipUnless(M is not None and PRONTO, "precisa do pysword e do dicionário de /usr/share/dict")
class BroadusMatthew(unittest.TestCase):
    def test_limpeza_tira_cabecalho_nota_e_mantem_espacamento_do_marcador(self):
        linhas = M.limpa_linhas(MT1, M.CONFIGS["broadus-matthew"].pagina)
        self.assertNotIn("MATTHEW.", linhas)
        self.assertFalse(any(x.startswith("1  Or") for x in linhas), "nota de rodapé")
        self.assertFalse(any(x.startswith("2  Abraham") for x in linhas), "versículo impresso no texto")
        # o marcador "1.  The" tem dois espaços: é esse espaçamento que o torna forte
        self.assertIn("1.  The  opening  words  signify  either,  Book", linhas)

    def test_hifenizacao_de_fim_de_linha(self):
        self.assertEqual(M.junta_paragrafos(["Ju-", "das, is the one"]), ["Judas, is the one"])

    def test_comentario_de_versiculo_com_citacao_de_at(self):
        """Mt 1:23 cita Isa 7:14: a linha é de Mateus (40001023), e a referência do AT fica no texto."""
        pares, stats = _comentarios(MT1)
        por_verso = {(c, a): (b, ps) for c, a, b, ps in pares}
        self.assertIn((1, 23), por_verso)
        b, ps = por_verso[(1, 23)]
        self.assertEqual(b, 23)
        texto = " ".join(M.junta_paragrafos(ps))
        self.assertTrue(texto.startswith("The quotation is from Isa. 7 : 14."), texto[:80])
        self.assertIn("Isa. 7 : 14", texto)

    def test_nota_numerada_com_espacamento_irregular_nao_vira_versiculo(self):
        """"3.     Everywhere" (cinco espaços) é nota do comentário de v. 1, não o versículo 3."""
        pares, _ = _comentarios(MT1)
        numeros = [(c, a) for c, a, _, _ in pares]
        self.assertNotIn((1, 3), numeros)
        self.assertIn((1, 1), numeros)
        self.assertIn((1, 2), numeros)

    def test_texto_de_versiculo_fica_no_seu_versiculo(self):
        pares, _ = _comentarios(MT1)
        por_verso = {(c, a): ps for c, a, _, ps in pares}
        texto_v1 = " ".join(M.junta_paragrafos(por_verso[(1, 1)]))
        self.assertIn("Everywhere else in the Gospels", texto_v1, "a nota de cinco espaços continua no v. 1")
        self.assertNotIn("Among the sons", texto_v1)
        self.assertIn("Among the sons", " ".join(M.junta_paragrafos(por_verso[(1, 2)])))

    def test_linha_com_lixo_de_ocr_sai_com_motivo(self):
        """Parágrafo com barra de coluna ("|", OCR de texto em duas colunas) sai como lixo; o limpo fica."""
        palavras = M.load_dict()
        limpo = ["The opening words signify either a matter of doubt here and it is of no real importance."]
        com_lixo = ["The first sentence of this comment is a plain statement  | and  more words follow here."]
        self.assertIsNone(M.lixo(limpo, palavras, M.Counter()))
        self.assertEqual(M.lixo(com_lixo, palavras, M.Counter()), "lixo_ocr")

    def test_footnote_colada_e_digito_o(self):
        self.assertEqual(M.tira_nota_colada("birth1"), "birth")
        self.assertEqual(M.tira_nota_colada("1This"), "This")
        self.assertEqual(M.tira_nota_colada("subsequent^7"), "subsequent")
        self.assertEqual(M.corrige_digito_o("2O."), "20.")
        self.assertEqual(M.corrige_digito_o("1G:"), "10:")

    def test_intervalo_de_versiculos_ocupa_o_intervalo_inteiro(self):
        """"VERSES 18-32." (Hodge) é um comentário só, cujo intervalo vai do 18 ao 32."""
        texto = "CHAPTER  I.\n\nVERSES  18-32.\n\nThe wrath of God is revealed against all ungodliness of men here.\n"
        cfg = M.CONFIGS["hodge-romans"]
        pares, _ = M.comentarios(M.limpa_linhas(texto, cfg.pagina), cfg)
        self.assertEqual([(c, a, b) for c, a, b, _ in pares], [(1, 18, 32)])


@unittest.skipUnless(M is not None, "precisa do pysword")
class Sequencia(unittest.TestCase):
    def test_maior_sequencia_crescente_descarta_nota_menor(self):
        # 1, 2, depois notas 1 e 2 (sub-notas do comentário de 18), e 18..20 do texto
        valores = [1, 2, 1, 2, 18, 19, 20]
        escolhidos = M._sequencia_crescente(valores)
        self.assertEqual(sorted(valores[i] for i in escolhidos), [1, 2, 18, 19, 20])

    def test_inicio_de_capitulo_sem_cabecalho(self):
        # fim do capítulo 1 (27 versículos) seguido de "1.": o OCR perdeu o cabeçalho do capítulo 2
        texto = "CHAPTER  I.\n\n" + "\n\n".join(f"{v}.  The  comment  for  verse  {v}  of  chapter  one  here."
                                                 for v in range(1, 23)) + \
            "\n\n23.  The  comment  for  verse  twenty  three  of  chapter  one  is  here.\n\n" \
            "24.  The  comment  for  verse  twenty  four  of  chapter  one  is  here.\n\n" \
            "25.  The  comment  for  verse  twenty  five  of  chapter  one  is  here.\n\n" \
            "1.  The  first  verse  of  the  next  chapter  has  a  comment  here  too.\n"
        pares, stats = _comentarios(texto)
        caps = {(c, a) for c, a, _, _ in pares}
        self.assertIn((2, 1), caps)


# Rm 1:16 (Haldane): o bloco começa com o próprio versículo (sai), e o comentário vem depois.
HALDANE_RM1 = """\
CHAPTER    I.— PART    I.
ROMANS  i.  1-15.

Ver.  15.—  So,  as  much  as  is  in  me,  I  am  ready  to  preach  the  Gospel  to  you.

Ver.  16.—  For  I  am  not  ashamed  of  the  Gospel  of  Chr'ist ;  for  it  is  the  power  of
God  unto  salvation  to  every  one  that  believeth  ;  to  the  Jew  first,  and  also  to  the
Greek.

I  am  not  ashamed. — Paul  here  follows  up  what  he  had  just  said  of  his
readiness  to  preach  the  Gospel  at  Rome,  by  declaring  that  he  was  not
ashamed  of  it.  This  would  also  convey  a  caution  to  those  whom  he
addressed  against  giving  way  to  a  strong  temptation.
"""


@unittest.skipUnless(M is not None and PRONTO, "precisa do pysword e do dicionário de /usr/share/dict")
class HaldaneRomanos(unittest.TestCase):
    def test_bloco_do_versiculo_sai_a_escritura_e_fica_o_comentario(self):
        pares, _ = _comentarios(HALDANE_RM1, "haldane-romans")
        por_verso = {(c, a): (b, ps) for c, a, b, ps in pares}
        self.assertIn((1, 16), por_verso)
        self.assertIn((1, 15), por_verso)
        ps = M.junta_paragrafos(por_verso[(1, 16)][1])
        if len(ps) > 1 and M.CONFIGS["haldane-romans"].sai_primeiro:
            ps = ps[1:]
        texto = " ".join(ps)
        self.assertTrue(texto.startswith("I am not ashamed."), texto[:60])
        self.assertNotIn("For I am not ashamed", texto)
        self.assertEqual(por_verso[(1, 16)][0], 16)


if __name__ == "__main__":
    unittest.main()
