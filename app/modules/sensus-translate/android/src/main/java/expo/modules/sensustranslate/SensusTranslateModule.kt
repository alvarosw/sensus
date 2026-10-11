package expo.modules.sensustranslate

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
 * Tradução no aparelho com Google ML Kit, só no par inglês -> português.
 * O modelo é baixado uma vez e fica no Google Play Services (funciona offline depois).
 * Nada é gravado pelo módulo: as traduções vivem só na memória do app (cache em translate/engine.ts).
 */
class SensusTranslateModule : Module() {
  private val translator: Translator by lazy {
    Translation.getClient(
      TranslatorOptions.Builder()
        .setSourceLanguage(TranslateLanguage.ENGLISH)
        .setTargetLanguage(TranslateLanguage.PORTUGUESE)
        .build(),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("SensusTranslate")

    /** true quando os dois modelos (en e pt) estão baixados. */
    AsyncFunction("status") { promise: Promise ->
      RemoteModelManager.getInstance()
        .getDownloadedModels(TranslateRemoteModel::class.java)
        .addOnSuccessListener { models ->
          val codes = models.map { it.language }.toSet()
          promise.resolve(
            codes.contains(TranslateLanguage.ENGLISH) && codes.contains(TranslateLanguage.PORTUGUESE),
          )
        }
        .addOnFailureListener { promise.reject("ML_KIT_STATUS", it.message, it) }
      Unit
    }

    /** Baixa os modelos se faltarem (Wi-Fi não é exigido). */
    AsyncFunction("download") { promise: Promise ->
      translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { promise.reject("ML_KIT_DOWNLOAD", it.message, it) }
      Unit
    }

    /** Traduz uma lista de trechos, na ordem recebida. */
    AsyncFunction("translate") { texts: List<String>, promise: Promise ->
      if (texts.isEmpty()) {
        promise.resolve(emptyList<String>())
      } else {
        translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
          .addOnSuccessListener { translateFrom(texts, 0, ArrayList(texts.size), promise) }
          .addOnFailureListener { promise.reject("ML_KIT_TRANSLATE", it.message, it) }
      }
      Unit
    }

    /** Apaga os dois modelos do aparelho. Par ausente é ignorado. */
    AsyncFunction("removeModels") { promise: Promise ->
      val manager = RemoteModelManager.getInstance()
      val en = TranslateRemoteModel.Builder(TranslateLanguage.ENGLISH).build()
      val pt = TranslateRemoteModel.Builder(TranslateLanguage.PORTUGUESE).build()
      manager.deleteDownloadedModel(en).addOnCompleteListener {
        manager.deleteDownloadedModel(pt).addOnCompleteListener { promise.resolve(null) }
      }
      Unit
    }
  }

  private fun translateFrom(texts: List<String>, index: Int, out: MutableList<String>, promise: Promise) {
    if (index >= texts.size) {
      promise.resolve(out)
      return
    }
    translator.translate(texts[index])
      .addOnSuccessListener { result ->
        out.add(result)
        translateFrom(texts, index + 1, out, promise)
      }
      .addOnFailureListener { promise.reject("ML_KIT_TRANSLATE", it.message, it) }
  }
}
