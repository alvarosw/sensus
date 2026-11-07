package expo.modules.sensustranslate

import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tradução no aparelho com Google ML Kit, para qualquer par dos idiomas do app. Os códigos chegam do JS já no formato
 * do ML Kit (campo mlkit de APP_LANGS, que é o valor de TranslateLanguage, ex.: "pt", "zh").
 * O modelo de cada idioma é baixado uma vez e fica no Google Play Services (funciona offline depois).
 * Nada é gravado pelo módulo: as traduções vivem só na memória do app (cache em translate/engine.ts).
 */
class SensusTranslateModule : Module() {
  /** Tradutores por par ("en>pt"), criados na primeira vez e reaproveitados. */
  private val translators = HashMap<String, Translator>()

  private fun translatorFor(from: String, to: String): Translator {
    return translators.getOrPut("$from>$to") {
      Translation.getClient(
        TranslatorOptions.Builder()
          .setSourceLanguage(from)
          .setTargetLanguage(to)
          .build(),
      )
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SensusTranslate")

    /** true quando os dois modelos do par (origem e destino) estão baixados. */
    AsyncFunction("status") { from: String, to: String, promise: Promise ->
      RemoteModelManager.getInstance()
        .getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models ->
          val codes = models.map { it.language }.toSet()
          promise.resolve(codes.contains(from) && codes.contains(to))
        }
        .addOnFailureListener { promise.reject("ML_KIT_STATUS", it.message, it) }
      Unit
    }

    /** Baixa os modelos do par se faltarem (Wi-Fi não é exigido). */
    AsyncFunction("download") { from: String, to: String, promise: Promise ->
      translatorFor(from, to).downloadModelIfNeeded(DownloadConditions.Builder().build())
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { promise.reject("ML_KIT_DOWNLOAD", it.message, it) }
      Unit
    }

    /** Traduz uma lista de trechos do par, na ordem recebida. */
    AsyncFunction("translate") { texts: List<String>, from: String, to: String, promise: Promise ->
      if (texts.isEmpty()) {
        promise.resolve(emptyList<String>())
      } else {
        val translator = translatorFor(from, to)
        translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
          .addOnSuccessListener { translateFrom(translator, texts, 0, ArrayList(texts.size), promise) }
          .addOnFailureListener { promise.reject("ML_KIT_TRANSLATE", it.message, it) }
      }
      Unit
    }

    /** Apaga os modelos baixados, exceto o inglês (compartilhado por todos os pares). Modelo ausente é ignorado. */
    AsyncFunction("removeModels") { promise: Promise ->
      val manager = RemoteModelManager.getInstance()
      manager.getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models ->
          val deletes = models
            .filter { it.language != TranslateLanguage.ENGLISH }
            .map { manager.deleteDownloadedModel(it) }
          Tasks.whenAllComplete(deletes).addOnCompleteListener { promise.resolve(null) }
        }
        .addOnFailureListener { promise.reject("ML_KIT_REMOVE", it.message, it) }
      Unit
    }
  }

  private fun translateFrom(
    translator: Translator,
    texts: List<String>,
    index: Int,
    out: MutableList<String>,
    promise: Promise,
  ) {
    if (index >= texts.size) {
      promise.resolve(out)
      return
    }
    translator.translate(texts[index])
      .addOnSuccessListener { result ->
        out.add(result)
        translateFrom(translator, texts, index + 1, out, promise)
      }
      .addOnFailureListener { promise.reject("ML_KIT_TRANSLATE", it.message, it) }
  }
}
